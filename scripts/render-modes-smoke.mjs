import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { startVisualLabChromeHost, connectVisualLabIncognitoPage } from './visual-lab-chrome-host.mjs';

// Exercise the built application and real native saves in one browser context.
// Run npm run build first. GPU_MODE=swiftshader forces software WebGL.
const baseUrl = process.env.RENDER_BASE_URL;
const output = baseUrl ? '.artifacts/published-render-modes' : '.artifacts/render-modes';
await mkdir(output, { recursive: true });
const server = baseUrl ? undefined : await preview({ preview: { host: '127.0.0.1', port: 4187, strictPort: true } });
const host = await startVisualLabChromeHost({ gpuMode: process.env.GPU_MODE ?? 'auto' });
let page;
const live2D = process.argv.includes('--live-2d');
const errors = [], report = { checks: [], gpuMode: process.env.GPU_MODE ?? 'auto' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = text => createHash('sha256').update(text).digest('hex');
try {
  const { browserWebSocketDebuggerUrl } = await host.ready();
  page = await connectVisualLabIncognitoPage({ browserWebSocketDebuggerUrl, url: 'about:blank' });
  const cdp = page.pageCdp;
  cdp.on('Runtime.exceptionThrown', event => errors.push(event));
  cdp.on('Runtime.consoleAPICalled', event => { if (event.type === 'error') errors.push(event); });
  cdp.on('Log.entryAdded', event => { if (event.entry.level === 'error') errors.push(event); });
  await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 60000);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await delay(250);
    }
    throw new Error(`Timed out: ${label}`);
  };
  const navigate = async search => {
    await cdp.send('Page.navigate', { url: new URL(search, baseUrl ?? 'http://127.0.0.1:4187/').href });
    await delay(300);
  };
  const capture = async name => {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, 60000);
    await writeFile(`${output}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const check = (label, condition) => { assert(condition, label); report.checks.push(label); console.log('PASS', label); };
  await navigate('?view=3d&paused=1&inputAudit=1');
  await waitFor('window.__ANIFOR_3D_AUDIT__?.state().stats.triangles > 0', '3D native frame');
  const initial = await evaluate('window.__ANIFOR_3D_AUDIT__.state()');
  check('3D uses native TPT WASM', initial.backend.includes('direct WebAssembly'));
  check('3D contains actual geometry and a populated native scene', initial.stats.triangles > 1000 && initial.stats.particles > 1000);
  check('3D loads no Pixi presenter', await evaluate("!performance.getEntriesByType('resource').some(r => r.name.includes('pixi-field-presenter'))"));
  report.initial3D = { ...initial, world: hash(initial.world) };
  report.gpu = await evaluate(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2'); const info=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(info?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),renderer:gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),version:gl.getParameter(gl.VERSION)}})()`);
  await capture('three-paused');
  if (live2D) {
    await evaluate('window.__ANIFOR_3D_AUDIT__.clear(); window.__ANIFOR_3D_AUDIT__.paint(200,60,1,8)');
    const worldBefore = (await evaluate('window.__ANIFOR_3D_AUDIT__.state()')).world;
    await click('[data-render-mode="2d"]');
    await waitFor("document.querySelector('[data-renderer-backend=webgl]') && document.querySelector('.pause')", 'live 2D WebGL');
    check('normal 2D WebGL uses one GPU frame in flight', await evaluate("!!document.querySelector('canvas[data-frame-backpressure=single-frame]')"));
    check('paused 2D control displays Play', await evaluate("document.querySelector('.pause').textContent === 'Play'"));
    await click('.pause'); await delay(5500); await click('.pause');
    check('native simulation and autosave advance in live 2D', await evaluate("localStorage.getItem('stillroom-world-v1')") !== worldBefore);
    const point = await evaluate("(()=>{const r=document.querySelector('.viewport').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await cdp.send('Input.dispatchMouseEvent', {type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});
    await cdp.send('Input.dispatchMouseEvent', {type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
    await capture('two-webgl-live');
    report.twoD = await evaluate("({host:{...document.querySelector('.viewport').dataset},canvas:{...document.querySelector('canvas[data-renderer=semantic-field-webgl]').dataset}})");
    await click('[data-render-mode="3d"]');
    await waitFor("document.querySelector('canvas[data-renderer=three-webgl]')", 'live world back in 3D');
    await navigate('?view=3d&handoff=1&paused=1&inputAudit=1');
    await waitFor('!!window.__ANIFOR_3D_AUDIT__', 'paint verification');
    check('2D pointer painting reaches native cells and survives the mode switch', await evaluate('window.__ANIFOR_3D_AUDIT__.cell(306,192) !== 0'));
    check('live 2D has no browser or shader errors', errors.length === 0);
    report.passed = true;
  } else {
  const orbitStart = await evaluate('window.__ANIFOR_3D_AUDIT__.state().camera');
  const orbitPoint = await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...orbitPoint, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: orbitPoint.x + 110, y: orbitPoint.y + 25, button: 'left', buttons: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: orbitPoint.x + 110, y: orbitPoint.y + 25, button: 'left', buttons: 0, clickCount: 1 });
  await delay(300);
  check('orbit gestures move the 3D camera', JSON.stringify(await evaluate('window.__ANIFOR_3D_AUDIT__.state().camera')) !== JSON.stringify(orbitStart));

  // Draw through browser pointer events; the renderer must raycast to the native plane.
  await click('[data-action="front"]'); await click('[data-camera="draw"]'); await delay(400);
  const point = await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
  check('3D pointer drawing changes native cells at the ray intersection', await evaluate('window.__ANIFOR_3D_AUDIT__.cell(306,192) !== 0'));
  const pausedWorld = (await evaluate('window.__ANIFOR_3D_AUDIT__.state()')).world;
  await click('[data-render-mode="2d"]');
  await waitFor("document.querySelector('[data-renderer-backend=webgl]') && document.querySelector('[data-render-mode=\"3d\"]')", '2D WebGL promotion');
  check('2D loads native TPT and Realistic WebGL', await evaluate("document.querySelector('.status').textContent.includes('direct WebAssembly') && !!document.querySelector('canvas[data-hdr-pipeline=active]')"));
  check('2D preserves pause on mode switch', await evaluate("new URLSearchParams(location.search).get('paused') === '1'"));
  report.twoD = await evaluate("({status:document.querySelector('.status').textContent,canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,data:{...c.dataset}}))})");
  await capture('two-webgl-paused');
  await click('[data-render-mode="3d"]');
  await waitFor("document.querySelector('canvas[data-renderer=three-webgl]')", '3D return');
  // Enable the explicit audit hook on reload without dropping the handoff or saved state.
  await navigate('?view=3d&handoff=1&paused=1&inputAudit=1');
  await waitFor('window.__ANIFOR_3D_AUDIT__?.state().stats.triangles > 0', '3D restored frame');
  const restored = await evaluate('window.__ANIFOR_3D_AUDIT__.state()');
  check('3D → 2D → 3D preserves the complete paused native save', restored.world === pausedWorld);

  const downloadPath = resolve(output, 'downloads');
  await mkdir(downloadPath, {recursive: true});
  await host.browserCdp.send('Browser.setDownloadBehavior', {behavior: 'allowAndName', downloadPath, browserContextId: page.browserContextId, eventsEnabled: true});
  const download = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Native save download timed out')), 15000);
    host.browserCdp.on('Browser.downloadProgress', event => {
      if (event.state === 'completed') { clearTimeout(timeout); resolve(event.guid); }
    });
  });
  await click('[data-action="save"]');
  const savePath = resolve(downloadPath, await download);
  check('Save file exports native OPS bytes', (await readFile(savePath)).subarray(0, 3).toString() === 'OPS');
  await evaluate('window.__ANIFOR_3D_AUDIT__.clear()');
  const document = await cdp.send('DOM.getDocument');
  const input = await cdp.send('DOM.querySelector', {nodeId: document.root.nodeId, selector: '.studio-file'});
  await cdp.send('DOM.setFileInputFiles', {nodeId: input.nodeId, files: [savePath]});
  await waitFor("document.querySelector('.studio-notice').textContent.startsWith('Opened ')", 'native file import');
  check('Open file restores the complete paused native world', (await evaluate('window.__ANIFOR_3D_AUDIT__.state()')).world === pausedWorld);
  await evaluate('window.__ANIFOR_3D_AUDIT__.step()'); await delay(250);
  check('native simulation advances in 3D', (await evaluate('window.__ANIFOR_3D_AUDIT__.state()')).world !== pausedWorld);
  await click('[data-action="pause"]'); await delay(2000); await click('[data-action="pause"]');
  report.live3D = await evaluate('({...window.__ANIFOR_3D_AUDIT__.state().stats})');
  await click('[data-action="reset-camera"]'); await delay(300); await capture('three-simulated');

  await evaluate('window.__ANIFOR_3D_AUDIT__.clear()');
  await click('[data-render-mode="2d"]');
  await waitFor("document.querySelector('[data-renderer-backend=webgl]') && document.querySelector('[data-render-mode=\"3d\"]')", 'empty 2D world');
  await click('[data-render-mode="3d"]'); await waitFor("document.querySelector('canvas[data-renderer=three-webgl]')", 'empty 3D world');
  await navigate('?view=3d&handoff=1&paused=1&inputAudit=1');
  await waitFor('!!window.__ANIFOR_3D_AUDIT__', 'empty-world audit');
  check('empty world survives mode switches without reseeding', (await evaluate('window.__ANIFOR_3D_AUDIT__.state()')).stats.particles === 0);
  await click('[data-action="demo"]'); await delay(300);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(400); await capture('three-mobile');
  check('3D mobile layout fits the viewport', await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  check('no browser or shader errors', errors.length === 0);
  report.passed = true;
  }
} catch (error) {
  report.passed = false; report.failure = String(error);
  if (page) { try { report.page = (await page.pageCdp.send('Runtime.evaluate', {expression: "JSON.stringify({status:document.querySelector('.status')?.textContent,host:document.querySelector('.viewport')?.dataset,body:document.body.innerText.slice(-800)})", returnByValue: true})).result.value; } catch {} }
  throw error;
} finally {
  await writeFile(`${output}/${live2D ? 'live-2d' : 'smoke'}.json`, JSON.stringify({ ...report, errors }, null, 2));
  await page?.close(); await host.teardown(); await server?.close();
}
