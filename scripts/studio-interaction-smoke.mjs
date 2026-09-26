import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { startVisualLabChromeHost, connectVisualLabIncognitoPage } from './visual-lab-chrome-host.mjs';

const output = '.artifacts/open-studio';
await mkdir(output, {recursive: true});
const server = await preview({preview: {host: '127.0.0.1', port: 4187, strictPort: true}});
const host = await startVisualLabChromeHost({gpuMode: process.env.GPU_MODE ?? 'auto'});
const report = {checks: [], errors: []};
let page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const {browserWebSocketDebuggerUrl} = await host.ready();
  page = await connectVisualLabIncognitoPage({browserWebSocketDebuggerUrl, url: 'about:blank'});
  const cdp = page.pageCdp;
  cdp.on('Runtime.exceptionThrown', event => report.errors.push(event));
  cdp.on('Runtime.consoleAPICalled', event => { if (event.type === 'error') report.errors.push(event); });
  cdp.on('Log.entryAdded', event => { if (event.entry.level === 'error') report.errors.push(event); });
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
  const evaluate = async expression => {
    const result = await cdp.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, 30000);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression, name) => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Timed out: ${name}`);
  };
  const check = (name, value) => { assert(value, name); report.checks.push(name); console.log('PASS', name); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const state = () => evaluate('window.__ANIFOR_3D_AUDIT__.state()');
  const project = (x, y, surface = true) => evaluate(`window.__ANIFOR_3D_AUDIT__.project(${x},${y},${surface})`);
  const cell = (x, y) => evaluate(`window.__ANIFOR_3D_AUDIT__.cell(${x},${y})`);
  const mouse = (type, point, button = 'left', buttons = 0) => cdp.send('Input.dispatchMouseEvent', {type, x: point.x, y: point.y, button, buttons, clickCount: type === 'mouseMoved' ? 0 : 1});
  const tap = async (point, button = 'left') => { await mouse('mousePressed', point, button, button === 'right' ? 2 : 1); await mouse('mouseReleased', point, button); };
  const capture = async name => {
    const result = await cdp.send('Page.captureScreenshot', {format: 'png', fromSurface: true});
    await writeFile(`${output}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  const reset = async () => { await evaluate('window.__ANIFOR_3D_AUDIT__.clear()'); await delay(150); };
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:4187/?view=3d&paused=1&inputAudit=1'});
  await waitFor('window.__ANIFOR_3D_AUDIT__?.state().stats.densePowderCells > 1000', 'native solid sand');
  const initial = await state();
  report.initial = {...initial, world: undefined};
  report.gpu = await evaluate(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const info=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)})()`);
  check('native TPT remains active', initial.backend.includes('direct WebAssembly'));
  check('dense powder uses a continuous bulk surface', initial.stats.densePowderCells > 1000);
  await waitFor("document.querySelector('canvas').dataset.frameFinish === 'cinematic'", 'cinematic finishing');
  await capture('open-scene');

  const materials = await evaluate("Object.fromEntries([...document.querySelectorAll('[data-material]')].map(b=>[b.textContent.trim(),Number(b.dataset.material)]))");
  await evaluate("document.querySelector('.studio-brush input').value='1';document.querySelector('.studio-brush input').dispatchEvent(new Event('input',{bubbles:true}))");
  const sand = await project(95, 320), plane = await project(95, 320, false);
  check('sand has substantial depth', sand.z > 15);
  check('angled surface differs visibly from the old z=0 picking plane', Math.hypot(sand.x - plane.x, sand.y - plane.y) > 8);
  const picked = await evaluate(`window.__ANIFOR_3D_AUDIT__.pick(${sand.x},${sand.y})`);
  check('angled picking resolves the visible sand cell', picked?.x === 95 && picked?.y === 320);
  await click('[data-camera="erase"]'); await tap(sand);
  check('erasing the thick sand surface edits the intended native cell', await cell(95, 320) === 0);
  const wood = await project(447, 325);
  check('rigid bodies also have substantial depth', wood.z > 35);
  await tap(wood);
  check('angled solid-body erasing edits the intended native cell', await cell(447, 325) === 0);

  // A sparse stream remains individual geometry instead of turning into a slab.
  await reset();
  await evaluate(`window.__ANIFOR_3D_AUDIT__.paint(306,192,${materials.Sand},0)`);
  await waitFor('window.__ANIFOR_3D_AUDIT__.state().stats.looseGrains === 1', 'loose grain');
  await tap(await project(306, 192));
  check('an individual grain can be picked and erased', await cell(306, 192) === 0);

  await reset();
  await evaluate(`window.__ANIFOR_3D_AUDIT__.paint(306,192,${materials.Wood},20)`); await delay(150);
  await click('[data-camera="orbit"]');
  const beforeOrbit = await state();
  const centre = await evaluate("(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,height:r.height}})()");
  await mouse('mousePressed', centre, 'left', 1);
  await mouse('mouseMoved', {x: centre.x + centre.height * 0.55, y: centre.y}, 'left', 1);
  await mouse('mouseReleased', {x: centre.x + centre.height * 0.55, y: centre.y});
  await waitFor('window.__ANIFOR_3D_AUDIT__.state().camera[2] < 0', 'full orbit');
  const back = await state();
  check('orbit can reach the back of the open scene', back.camera[2] < 0);
  check('orbit does not paint or advance the paused world', back.world === beforeOrbit.world);
  await click('[data-camera="erase"]'); await delay(150);
  const backPoint = await project(306, 192);
  check('back-facing geometry is picked at its actual depth', backPoint.z < -35);
  await tap(backPoint);
  check('editing from behind resolves the same native cell', await cell(306, 192) === 0);
  await capture('back-edit');

  // Test native wall ownership separately from ordinary particle material IDs.
  await reset(); await click('[data-action="reset-camera"]');
  await evaluate('window.__ANIFOR_3D_AUDIT__.paintWall(306,192,1,8)'); await delay(150);
  await tap(await project(306, 192));
  check('3D erasing also removes native walls', await evaluate('window.__ANIFOR_3D_AUDIT__.wall(306,192) === 0'));

  await reset(); await click('[data-action="front"]');
  await click(`[data-material="${materials.Sand}"]`);
  const a = await project(250, 140, false), b = await project(290, 140, false);
  await mouse('mousePressed', a, 'left', 1); await mouse('mouseMoved', b, 'left', 1); await mouse('mouseReleased', b);
  check('drag drawing produces a continuous native stroke', await evaluate(`Array.from({length:41},(_,i)=>window.__ANIFOR_3D_AUDIT__.cell(250+i,140)).every(v=>v===${materials.Sand})`));
  await tap(await project(270, 140), 'right');
  check('right-click erases while Draw is selected', await cell(270, 140) === 0);

  await click('[data-camera="erase"]');
  await mouse('mousePressed', await project(250, 140), 'left', 1);
  await mouse('mouseMoved', await project(290, 140), 'left', 1);
  await mouse('mouseReleased', await project(290, 140));
  check('drag erasing clears the native stroke', await evaluate('Array.from({length:41},(_,i)=>window.__ANIFOR_3D_AUDIT__.cell(250+i,140)).every(v=>v===0)'));

  await click('[data-camera="draw"]');
  const outside = await project(-25, 140, false), beforeBackground = (await state()).world;
  await tap(outside);
  check('the unbounded background does not accept out-of-world edits', (await state()).world === beforeBackground);
  const start = await project(260, 160, false), untouched = await project(300, 160, false);
  await mouse('mousePressed', start, 'left', 1); await mouse('mouseMoved', outside, 'left', 1); await mouse('mouseReleased', outside);
  await mouse('mouseMoved', untouched);
  check('releasing a stroke outside the world does not leave drawing stuck', await cell(300, 160) === 0);

  await click('[data-camera="orbit"]');
  const beforeZoom = await state();
  await cdp.send('Input.dispatchMouseEvent', {type:'mouseWheel', x:centre.x, y:centre.y, deltaX:0, deltaY:-180}); await delay(500);
  const afterZoom = await state();
  check('scroll zoom moves the camera without editing native state', Math.hypot(...afterZoom.camera) < Math.hypot(...beforeZoom.camera) && afterZoom.world === beforeZoom.world);
  await mouse('mousePressed', centre, 'right', 2); await mouse('mouseMoved', {x:centre.x+50,y:centre.y+20}, 'right', 2); await mouse('mouseReleased', {x:centre.x+50,y:centre.y+20}, 'right'); await delay(500);
  const afterPan = await state();
  check('right-drag pans without erasing native state', JSON.stringify(afterPan.target) !== JSON.stringify(afterZoom.target) && afterPan.world === afterZoom.world);

  await reset(); await click('[data-action="reset-camera"]'); await click('[data-camera="draw"]');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true}); await delay(250);
  const touchPoint = await project(306, 192, false);
  await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:touchPoint.x,y:touchPoint.y,id:0}]});
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  check('touch drawing after resize reaches the intended native cell', await cell(306, 192) === materials.Sand);
  await click('[data-action="demo"]'); await delay(250); await click('[data-camera="orbit"]'); await capture('open-mobile');
  check('mobile controls fit the viewport', await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await evaluate('for(let i=0;i<120;i++)window.__ANIFOR_3D_AUDIT__.step()'); await delay(200);
  report.settled = {...await state(), world: undefined};
  check('the simulated pile remains a continuous bulk surface', report.settled.stats.densePowderCells > 1000);
  await cdp.send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false}); await delay(250); await capture('open-simulated');
  check('no browser or shader errors', report.errors.length === 0);
  report.passed = true;
} catch (error) {
  report.passed = false; report.failure = String(error); throw error;
} finally {
  await writeFile(`${output}/interaction.json`, JSON.stringify(report, null, 2));
  await page?.close(); await host.teardown(); await server.close();
}
