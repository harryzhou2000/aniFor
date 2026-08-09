import path from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  connectVisualLabIncognitoPage,
  resolveVisualLabChrome,
  startVisualLabChromeHost,
} from './visual-lab-chrome-host.mjs';

const MODULE_PATH = realpathSync(new URL(import.meta.url));
const RECEIPT_SCHEMA = 'anifor.renderer.completed-frame-receipt/v1';
const VALID_SCALES = new Set([1, 2, 4, 8]);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const asError = (error) => error instanceof Error ? error : new Error(String(error));

const throwCollectedErrors = (errors, label) => {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, label);
};

const parseArguments = (argv) => {
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown completed-frame receipt option ${JSON.stringify(argument)}`);
    }
    const [name, ...parts] = argument.slice(2).split('=');
    if (!['bundle', 'render-scale', 'gpu', 'chrome'].includes(name) || values.has(name)) {
      throw new Error(`Unknown or duplicate completed-frame receipt option --${name}`);
    }
    values.set(name, parts.join('='));
  }
  const renderScale = Number(values.get('render-scale') ?? 2);
  if (!VALID_SCALES.has(renderScale)) {
    throw new Error('--render-scale must be 1, 2, 4, or 8');
  }
  const gpu = values.get('gpu') ?? 'swiftshader';
  if (gpu !== 'auto' && gpu !== 'swiftshader') {
    throw new Error('--gpu must be auto or swiftshader');
  }
  const bundle = path.resolve(values.get('bundle') ?? 'dist/index.html');
  return Object.freeze({ bundle, renderScale, gpu, chrome: values.get('chrome') });
};

const evaluate = async (cdp, expression, timeoutMs = 10_000) => {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, timeoutMs);
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return response.result.value;
};

const waitFor = async (operation, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(25);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
};

const assertReceipt = (receipt, ticket, state) => {
  if (receipt?.schema !== RECEIPT_SCHEMA || receipt.ticket !== ticket
    || receipt.state !== state || !Number.isSafeInteger(receipt.submission)
    || receipt.submission <= 0) {
    throw new Error(`Invalid ${state} completed-frame receipt ${JSON.stringify(receipt)}`);
  }
  return receipt;
};

const validateTerminalReceipt = (receipt, ticket) => {
  if (!['completed', 'superseded', 'failed'].includes(receipt?.state)) {
    throw new Error(`Invalid terminal completed-frame receipt ${JSON.stringify(receipt)}`);
  }
  return assertReceipt(receipt, ticket, receipt.state);
};

export async function auditWebGLCompletedFrameReceipt(options) {
  const url = pathToFileURL(options.bundle);
  for (const [name, value] of [
    ['scene', 'render-lab'],
    ['inputAudit', '1'],
    ['blankAudit', '1'],
    ['auditStage', 'visual-lab'],
    ['renderLook', 'realistic'],
    ['renderer', 'webgl'],
    ['renderScale', String(options.renderScale)],
  ]) url.searchParams.set(name, value);

  const chromePath = await resolveVisualLabChrome(options.chrome);
  let host;
  let incognitoPage;
  let page;
  let result;
  let auditError;
  let disposalError;
  let hostError;
  const browserErrors = [];
  let hostTeardown;
  const teardownHost = () => {
    hostTeardown ??= host?.teardown() ?? Promise.resolve();
    return hostTeardown;
  };
  const onSignal = (exitCode) => {
    void teardownHost().finally(() => process.exit(exitCode));
  };
  const onSigint = () => onSignal(130);
  const onSigterm = () => onSignal(143);
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    host = await startVisualLabChromeHost({
      chromePath,
      gpuMode: options.gpu,
      initialUrl: new URL('about:blank'),
      allowFileAccess: true,
    });
    const ready = await host.ready();
    incognitoPage = await connectVisualLabIncognitoPage({
      browserWebSocketDebuggerUrl: ready.browserWebSocketDebuggerUrl,
      url: new URL('about:blank'),
    });
    page = incognitoPage.pageCdp;
    page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      browserErrors.push(exceptionDetails?.exception?.description
        ?? exceptionDetails?.text ?? 'Runtime exception');
    });
    page.on('Log.entryAdded', ({ entry }) => {
      if (entry?.level === 'error') browserErrors.push(entry.text ?? 'Browser log error');
    });
    await Promise.all([
      page.send('Runtime.enable'),
      page.send('Log.enable'),
      page.send('Page.enable'),
    ]);
    const navigation = await page.send('Page.navigate', { url: url.href });
    if (navigation.errorText) {
      throw new Error(`Completed-frame receipt fixture navigation failed: ${navigation.errorText}`);
    }

    const startupTimeout = options.renderScale === 8 ? 45_000 : 20_000;
    const backend = await waitFor(() => evaluate(page, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const backend = audit?.backend?.();
      return backend?.backend === 'webgl' ? backend : null;
    })()`, options.renderScale === 8 ? 35_000 : 10_000),
    startupTimeout, `${options.renderScale}x WebGL startup`);

    // The ticket deliberately fails closed when a later presentation overtakes
    // it. Let the paused fixture finish its finite atmosphere/liquid/emission
    // hydration sequence before asking one exact frame to own the GPU proof.
    let previousRefresh = -1;
    let stableRefreshStartedAt = Date.now();
    const stableRefreshWindowMs = options.renderScale === 8 ? 2_000 : 1_000;
    await waitFor(async () => {
      const refresh = await evaluate(page, `(() => {
        const value = window.__ANIFOR_INPUT_AUDIT__?.presentationRefreshAudit?.();
        return Number.isSafeInteger(value?.sequence) ? value.sequence : null;
      })()`);
      if (refresh !== previousRefresh) {
        previousRefresh = refresh;
        stableRefreshStartedAt = Date.now();
      }
      return Date.now() - stableRefreshStartedAt >= stableRefreshWindowMs
        ? { sequence: refresh } : null;
    }, options.renderScale === 8 ? 40_000 : 15_000, 'paused presentation hydration');

    const receiptTimeout = options.renderScale === 8 ? 35_000 : 10_000;
    const requestTicket = async (label, timeoutMs = receiptTimeout) => waitFor(() => evaluate(page, `(() => {
      const ticket = window.__ANIFOR_INPUT_AUDIT__
        ?.requestWebGLCompletedFrameReceipt?.();
      return Number.isSafeInteger(ticket) && ticket > 0 ? ticket : null;
    })()`, Math.min(receiptTimeout, timeoutMs)), timeoutMs, `${label} request`);
    const waitForTerminalReceipt = async (ticket, label, timeoutMs = receiptTimeout) => waitFor(() => evaluate(page, `(() => {
      const receipt = window.__ANIFOR_INPUT_AUDIT__
        ?.webGLCompletedFrameReceipt?.(${ticket});
      return receipt && receipt.state !== 'pending' ? receipt : null;
    })()`, Math.min(receiptTimeout, timeoutMs)), timeoutMs, label);
    const completionDeadline = Date.now() + (options.renderScale === 8 ? 75_000 : 25_000);
    const remainingCompletionMs = (label) => {
      const remaining = completionDeadline - Date.now();
      if (remaining <= 0) throw new Error(`${label} exceeded the shared receipt deadline`);
      return remaining;
    };
    let supersededAttempts = 0;
    const requestCompleted = async (label) => {
      for (let attempt = 1; attempt <= 8; attempt++) {
        const ticket = await requestTicket(
          `${label} attempt ${attempt}`,
          remainingCompletionMs(`${label} request`),
        );
        const terminal = validateTerminalReceipt(await waitForTerminalReceipt(
          ticket,
          `${label} attempt ${attempt}`,
          remainingCompletionMs(`${label} completion`),
        ), ticket);
        if (terminal.state === 'completed') return { ticket, receipt: terminal };
        if (terminal.state === 'failed') {
          throw new Error(`${label} failed (${JSON.stringify(terminal)})`);
        }
        supersededAttempts++;
      }
      throw new Error(`${label} was superseded eight times`);
    };

    const firstResult = await requestCompleted('first completed-frame receipt');
    const { ticket: firstTicket, receipt: first } = firstResult;
    const secondTicket = await requestTicket(
      'second completed-frame receipt',
      remainingCompletionMs('second receipt request'),
    );
    const firstSuperseded = assertReceipt(
      await waitForTerminalReceipt(firstTicket, 'first receipt supersession'),
      firstTicket,
      'superseded',
    );
    const secondTerminal = validateTerminalReceipt(await waitForTerminalReceipt(
      secondTicket,
      'second completed-frame receipt',
      remainingCompletionMs('second receipt completion'),
    ), secondTicket);
    let second = secondTerminal;
    if (secondTerminal.state === 'failed') {
      throw new Error(`Second completed-frame receipt failed (${JSON.stringify(secondTerminal)})`);
    }
    if (secondTerminal.state === 'superseded') {
      supersededAttempts++;
      second = (await requestCompleted('replacement completed-frame receipt')).receipt;
    }
    if (second.submission <= first.submission
      || firstSuperseded.submission !== first.submission) {
      throw new Error(`Receipt submission order drifted (${JSON.stringify({ first, second })})`);
    }
    if (browserErrors.length > 0) {
      throw new Error(`Browser reported ${browserErrors.length} errors: ${browserErrors.join('\n')}`);
    }

    result = Object.freeze({
      schema: RECEIPT_SCHEMA,
      renderScale: options.renderScale,
      gpu: options.gpu,
      backend: backend.backend,
      backendReason: backend.reason,
      first: firstSuperseded,
      second,
      supersededAttempts,
      browserErrors: 0,
    });
  } catch (error) {
    auditError = asError(error);
  } finally {
    if (page) {
      try {
        await evaluate(page, `(async () => {
          const audit = window.__ANIFOR_INPUT_AUDIT__;
          if (typeof audit?.disposeRendererForNavigation !== 'function') {
            throw new Error('Renderer disposal audit API is unavailable');
          }
          await audit.disposeRendererForNavigation();
          return true;
        })()`, 10_000);
      } catch (error) { disposalError = asError(error); }
    }
    if (incognitoPage) {
      try { await incognitoPage.close(); }
      catch (error) {
        const closeError = asError(error);
        disposalError = disposalError
          ? new AggregateError(
            [disposalError, closeError],
            'Renderer disposal and incognito target teardown failed',
          )
          : closeError;
      }
    }
    try { await teardownHost(); }
    catch (error) { hostError = asError(error); }
    finally {
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
    }
  }
  throwCollectedErrors(
    [auditError, disposalError, hostError].filter(Boolean),
    'Completed-frame receipt audit, renderer disposal, or Chrome teardown failed',
  );
  return result;
}

const isDirectExecution = () => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === MODULE_PATH; }
  catch { return path.resolve(process.argv[1]) === MODULE_PATH; }
};

if (isDirectExecution()) {
  void auditWebGLCompletedFrameReceipt(parseArguments(process.argv.slice(2)))
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
