// Capture the same paused native save in both presentation modes.
// Usage: node scripts/capture-native-snapshot.mjs save.cps output-directory
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { startVisualLabChromeHost, connectVisualLabIncognitoPage } from './visual-lab-chrome-host.mjs';
const [input, output] = process.argv.slice(2);
assert(input && output, 'Supply a native save and an output directory');
await mkdir(output, { recursive: true });
const source = await readFile(input);
const report = { sha256: createHash('sha256').update(source).digest('hex'), views: {}, errors: [] };
const base = process.env.SNAPSHOT_BASE_URL;
const server = base ? undefined : await preview({ preview: { host: '127.0.0.1', port: 4187, strictPort: true } });
const host = await startVisualLabChromeHost({ gpuMode: 'auto' });
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  page = await connectVisualLabIncognitoPage({ ...await host.ready(), url: 'about:blank' });
  const cdp = page.pageCdp;
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  cdp.on('Runtime.exceptionThrown', e => report.errors.push(e));
  cdp.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') report.errors.push(e); });
  const evaluate = async expression => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 60000);
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const wait = async expression => {
    const until = Date.now() + 120000;
    while (Date.now() < until) { if (await evaluate(expression)) return; await delay(300); }
    throw Error(`Timed out: ${expression}`);
  };
  const capture = async (name, selector) => {
    const clip = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip }, 120000);
    await writeFile(`${output}/${name}.png`, Buffer.from(r.data, 'base64'));
  };
  for (const mode of (process.env.SNAPSHOT_MODES ?? '2d,3d').split(',')) {
    const studio = mode === '3d';
    await cdp.send('Page.navigate', { url: new URL(`?view=${mode}&scene=render-lab&blankAudit=1&paused=1&inputAudit=1&simulation=native&renderScale=2&renderLook=realistic&steamCondensateVfx=1`, base ?? 'http://127.0.0.1:4187/').href });
    const audit = studio ? 'window.__ANIFOR_3D_AUDIT__' : 'window.__ANIFOR_INPUT_AUDIT__';
    await wait(`!!${audit}`);
    const document = await cdp.send('DOM.getDocument');
    const node = await cdp.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: studio ? '.studio-file' : '.world-file-input' });
    await cdp.send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [resolve(input)] });
    await wait(studio ? 'document.querySelector(".studio-notice").textContent.startsWith("Opened ")' : 'document.querySelector(".open-file").textContent === "Opened"');
    await delay(6000);
    if (studio && process.env.SNAPSHOT_CONTACT === '1') {
      // A labelled diagnostic copy: bring steam into contact with this save's
      // existing slopes, then put water droplets inside it. No native steps.
      await evaluate(`(()=>{const a=${audit},empty=[];
        for(let y=245;y<365;y++)for(let x=170;x<430;x++)
          if((x+y)%3===0 && a.cell(x,y)===0)empty.push([x,y]);
        for(const[x,y]of empty)a.paint(x,y,15,0);
        for(const[x,y]of [[220,280],[260,295],[290,265],[355,280]]){a.paint(x,y,0,1);a.paint(x,y,2,1);}
      })()`);
      await writeFile(`${output}/contact.anifortpt`, 'anifortpt1\n' + await evaluate(`${audit}.state().world`));
      report.contactProbe = true;
      await delay(2500);
    }
    if (studio && process.env.SNAPSHOT_STEPS) {
      const steps = Number(process.env.SNAPSHOT_STEPS);
      assert(Number.isInteger(steps) && steps > 0 && steps <= 3600);
      await evaluate(`(()=>{for(let i=0;i<${steps};i++)${audit}.step();})()`);
      await writeFile(`${output}/evolved.anifortpt`, 'anifortpt1\n' + await evaluate(`${audit}.state().world`));
      report.evolvedSteps = steps;
      await delay(2000);
    }
    const digest = studio ? `JSON.stringify(${audit}.state().world)` : `JSON.stringify(${audit}.materialPlaneDigest())`;
    const before = await evaluate(digest);
    const selector = studio ? 'canvas[data-renderer="three-webgl"]' : 'canvas[data-renderer="semantic-field-webgl"]';
    await wait(`!!document.querySelector(${JSON.stringify(selector)})`);
    await capture(mode, selector);
    report.views[mode] = { digest: createHash('sha256').update(before).digest('hex'), canvas: await evaluate(`({...document.querySelector(${JSON.stringify(selector)}).dataset})`) };
    if (studio) {
      report.views[mode].state = await evaluate(`(()=>{const{world,...state}=${audit}.state();return state})()`);
      await evaluate('document.querySelector("[data-action=front]").click()');
      await delay(4000);
      await capture('3d-front', selector);
    } else {
      report.views[mode].materials = JSON.parse(before);
      await evaluate(`${audit}.setVisualTime(6000)`); await delay(2000);
      await capture('2d-6s', selector);
    }
    assert.equal(await evaluate(digest), before, `${mode} presentation must preserve the paused native world`);
    console.log(`Captured ${mode}; native world unchanged`);
  }
  assert.equal(report.errors.length, 0, 'No browser or shader errors');
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await page?.close(); await host.teardown(); await server?.close();
}
