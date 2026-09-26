import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { startVisualLabChromeHost, connectVisualLabIncognitoPage } from './visual-lab-chrome-host.mjs';
import { decodeVisualLabPng } from './visual-lab-png.mjs';
const baseUrl = process.env.FIELD_BASE_URL;
const output = process.argv[2] ?? (baseUrl ? '.artifacts/published-field' : '.artifacts/field-materials');
await mkdir(output, {recursive:true});
const server = baseUrl ? undefined : await preview({preview:{host:'127.0.0.1',port:4187,strictPort:true}});
const host = await startVisualLabChromeHost({gpuMode:'auto'});
let page;
const delay = ms => new Promise(r=>setTimeout(r,ms));
const report = { checks: [], errors: [], layouts: [], motion: {} };
const check = (label, condition) => { assert(condition, label); report.checks.push(label); console.log('PASS', label); };
try {
  page = await connectVisualLabIncognitoPage({...await host.ready(),url:'about:blank'});
  const cdp=page.pageCdp;
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const errors=report.errors;
  cdp.on('Runtime.exceptionThrown',e=>errors.push(e));
  cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(e)});
  const evaluate=async expression=>{const r=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},60000);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const query = '?view=2d&scene=render-lab&blankAudit=1&simulation=native&inputAudit=1&renderLook=realistic&renderScale=2&steamCondensateVfx=1';
  await cdp.send('Page.navigate',{url:new URL(query,baseUrl ?? 'http://127.0.0.1:4187/').href});
  for(let i=0;i<150;i++){if(await evaluate('!!window.__ANIFOR_INPUT_AUDIT__ && !!document.querySelector("canvas[data-renderer=semantic-field-webgl]")')) break;await delay(400);}
  await evaluate('window.__ANIFOR_INPUT_AUDIT__.clear()');
  check('native TPT and HDR WebGL are active', await evaluate('document.querySelector(".status").textContent.includes("direct WebAssembly") && !!document.querySelector("canvas[data-hdr-pipeline=active]")'));
  const capture = async name => {
    const bytes=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true},60000)).data,'base64');
    await writeFile(`${output}/${name}.png`,bytes);
    return decodeVisualLabPng(bytes,name);
  };
  const click = async selector => {
    const p=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)throw Error('Missing ${selector}');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!b.contains(document.elementFromPoint(x,y)))throw Error('Obscured ${selector}');return{x,y};})()`);
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',buttons:0,clickCount:1});
  };
  const stroke = async (material,radius,points) => {
    const projected=await evaluate(`(()=>{const a=window.__ANIFOR_INPUT_AUDIT__;a.setMaterial(${material});a.setRadius(${radius});return ${JSON.stringify(points)}.map(([x,y])=>a.worldToScreen(x,y));})()`);
    const [p,...rest]=projected;
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
    for(const p of rest) await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,button:'left',buttons:1});
    const end=projected.at(-1);
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',buttons:0,clickCount:1});
  };
  await stroke(15,45,[[100,95],[155,70],[215,100]]);
  await stroke(2,52,[[100,260],[230,260]]);
  await stroke(11,40,[[397,92],[490,92]]);
  await stroke(1,30,[[370,310],[535,310]]);
  await stroke(1,32,[[396,276],[508,276]]);
  await stroke(1,30,[[420,246],[480,246]]);
  await stroke(1,28,[[447,218],[453,218]]);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:20,buttons:0});
  await delay(4500);
  const frozenWorld=await evaluate('window.__ANIFOR_INPUT_AUDIT__.materialPlaneDigest()');
  const frame1=await capture('materials-1s');
  await evaluate('window.__ANIFOR_INPUT_AUDIT__.setVisualTime(6000)');
  await delay(1500);
  const frame2=await capture('materials-6s');
  const regions={steam:[105,70,200,103],water:[100,245,230,285],lava:[397,73,490,115],sand:[410,283,500,315]};
  for(const [name,[x0,y0,x1,y1]] of Object.entries(regions)) {
    const [a,b]=await evaluate(`[[${x0},${y0}],[${x1},${y1}]].map(([x,y])=>window.__ANIFOR_INPUT_AUDIT__.worldToScreen(x,y))`);
    let sum=0,count=0;
    for(let y=Math.ceil(a.y);y<Math.floor(b.y);y++)for(let x=Math.ceil(a.x);x<Math.floor(b.x);x++)for(let c=0;c<3;c++){
      const i=(y*frame1.width+x)*frame1.channels+c;sum+=Math.abs(frame1.pixels[i]-frame2.pixels[i]);count++;
    }
    report.motion[name]=sum/count;
    check(`${name} ${name==='sand'?'stays stable':'lighting evolves'} across five seconds`,name==='sand'?sum/count<1:sum/count>0.1);
  }
  check('shader animation leaves native materials unchanged',JSON.stringify(await evaluate('window.__ANIFOR_INPUT_AUDIT__.materialPlaneDigest()'))===JSON.stringify(frozenWorld));
  // Scaled desktop CSS viewports, equivalent to a 1920x1080 display at
  // 125%, 150%, and 200%. Keep the two-column desktop layout in every case.
  for(const scale of [1.25,1.5,2]) {
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(1920/scale),height:Math.round(1080/scale),deviceScaleFactor:scale,mobile:false});
    await delay(1000);
    const layout=await evaluate(`(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};return{scale:${scale},viewport:rect('.viewport'),library:rect('.tool-library'),actions:rect('.actions'),filters:rect('.tool-filters'),bodyWidth:document.body.scrollWidth,width:innerWidth}})()`);
    report.layouts.push(layout);
    check(`${scale*100}% desktop keeps an accessible catalog beside the world`,layout.actions.x>layout.viewport.right && layout.library.height>=70 && layout.library.bottom<=layout.actions.y+1 && layout.bodyWidth<=layout.width);
    await click('.render-settings summary');
    await delay(200);
    check(`${scale*100}% expanded Appearance does not overlap tools`,await evaluate(`(()=>{const a=document.querySelector('.actions').getBoundingClientRect(),b=document.querySelector('.tool-library').getBoundingClientRect();return b.height>30&&b.bottom<=a.top+1})()`));
    await click('.render-settings summary');
    await click('.fit-view');
    await capture(`desktop-${scale*100}`);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await delay(600);
  await evaluate('window.__ANIFOR_INPUT_AUDIT__.clear();window.__ANIFOR_INPUT_AUDIT__.setRadius(2)');
  const search = async text => { await evaluate(`(()=>{const i=document.querySelector('.tool-search input');i.value=${JSON.stringify(text)};i.dispatchEvent(new Event('input',{bubbles:true}));})()`); await delay(100); };
  await search('water');
  await click('[data-tool-key="material:2"] .material-button');
  check('selected tool is visible even outside the library',await evaluate('document.querySelector(".active-tool").textContent==="Water"'));
  await click('input[aria-label="Brush size"]');
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});
  await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36});
  check('brush slider exposes a precise one-cell radius',await evaluate('/^1 cells?$/.test(document.querySelector(".brush-radius-value").textContent)'));
  const tap = async (x,y,button='left')=>{
    const p=await evaluate(`window.__ANIFOR_INPUT_AUDIT__.worldToScreen(${x},${y})`);
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button,buttons:button==='right'?2:1,clickCount:1});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button,buttons:0,clickCount:1});
  };
  await tap(306,192);
  check('Water brush paints native cells',await evaluate('window.__ANIFOR_INPUT_AUDIT__.cell(306,192)===2'));
  check('brush radius reaches native painting',await evaluate('window.__ANIFOR_INPUT_AUDIT__.cell(308,192)===0'));
  await click('[data-erase="true"]'); await tap(306,192);
  check('visible Eraser removes native cells',await evaluate('window.__ANIFOR_INPUT_AUDIT__.cell(306,192)===0'));
  await click('[data-tool-key="material:2"] .material-button'); await tap(306,192);
  check('selecting a material exits Eraser and synchronizes the controls',await evaluate('window.__ANIFOR_INPUT_AUDIT__.cell(306,192)===2 && document.querySelector("[data-erase=false]").getAttribute("aria-pressed")==="true"'));
  await tap(306,192,'right');
  check('right click still erases independently',await evaluate('window.__ANIFOR_INPUT_AUDIT__.cell(306,192)===0'));
  await search('sand'); await click('[data-tool-key="material:1"] .material-button');
  await tap(306,70);
  const beforeStep=await evaluate('window.__ANIFOR_INPUT_AUDIT__.materialPlaneDigest().hash');
  // Native subcell acceleration need not cross a raster cell on its first
  // tick. Several explicit steps prove progress without assuming that it does.
  for(let i=0;i<8;i++) await click('.step');
  await delay(500);
  check('Step advances native physics and leaves the world paused',await evaluate(`document.querySelector('.pause').textContent==='Play' && window.__ANIFOR_INPUT_AUDIT__.materialPlaneDigest().hash!==${beforeStep}`));
  const afterStep=await evaluate('window.__ANIFOR_INPUT_AUDIT__.materialPlaneDigest().hash');
  await delay(350);
  check('Step remains paused',await evaluate(`window.__ANIFOR_INPUT_AUDIT__.materialPlaneDigest().hash===${afterStep}`));
  await search('');
  await evaluate(`(()=>{const c=document.querySelector('.tool-category');c.value='thermal';c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  check('category selector exposes thermal tools',await evaluate('document.querySelectorAll("[data-tool-kind=thermal]").length>0'));
  await stroke(23,3,[[306,192]]);
  const cold=await evaluate('window.__ANIFOR_INPUT_AUDIT__.temperature(306,192)');
  await click('[data-tool-key="tool:heat"] .material-button');
  await tap(306,192);
  check('Heat tool changes native temperature without replacing the material',await evaluate(`window.__ANIFOR_INPUT_AUDIT__.temperature(306,192)>${cold} && window.__ANIFOR_INPUT_AUDIT__.cell(306,192)===23`));
  const hot=await evaluate('window.__ANIFOR_INPUT_AUDIT__.temperature(306,192)');
  await click('[data-tool-key="tool:cool"] .material-button'); await tap(306,192);
  check('Cool lowers native temperature',await evaluate(`window.__ANIFOR_INPUT_AUDIT__.temperature(306,192)<${hot}`));
  await click('[data-tool-key="tool:heat"] .material-button');
  const held=await evaluate('window.__ANIFOR_INPUT_AUDIT__.worldToScreen(306,192)');
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...held,button:'left',buttons:1,clickCount:1});
  // A software GPU can deliver fewer than 20 frames/second. Wait for actual
  // repeated native edits rather than treating a 450ms frame budget as behavior.
  for (let i=0;i<50;i++) {
    if (await evaluate(`window.__ANIFOR_INPUT_AUDIT__.temperature(306,192)>${hot}+20`)) break;
    await delay(100);
  }
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...held,button:'left',buttons:0,clickCount:1});
  check('holding Heat keeps applying the tool while paused',await evaluate(`window.__ANIFOR_INPUT_AUDIT__.temperature(306,192)>${hot}+20`));
  await evaluate(`(()=>{const c=document.querySelector('.tool-category');c.value='all';c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const groups=await evaluate('[...document.querySelectorAll("details.material-group[open]")].map(e=>e.dataset.category)');
  await search('water'); await search('');
  check('search does not permanently expand unrelated categories',JSON.stringify(await evaluate('[...document.querySelectorAll("details.material-group[open]")].map(e=>e.dataset.category)'))===JSON.stringify(groups));
  await search('BGLA');
  check('native element codes find readable labels',await evaluate(`document.querySelector('[data-tool-key="material:44"] .material-button').textContent.includes('Broken Glass')`));
  await search('');
  check('picker omits unsupported tools and native-only products',await evaluate(`!document.querySelector('.material-button:disabled') && !document.querySelector('[data-tool-key="wall:4"]')`));
  await search('CLNE'); await click('[data-tool-key="source:clne"] .material-button');
  await search('water'); await click('[data-tool-key="material:2"] .material-button');
  await tap(340,192);
  check('configured Clone targets native Water',await evaluate('window.__ANIFOR_INPUT_AUDIT__.sourceTarget(340,192)===2 && document.querySelector(".active-tool").textContent==="Clone → Water"'));
  await click('.source-target-brush');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(700);
  check('mobile puts frequent actions before the library without horizontal overflow',await evaluate('document.querySelector(".actions").getBoundingClientRect().top<document.querySelector(".palette").getBoundingClientRect().top && document.body.scrollWidth<=innerWidth'));
  await click('.fit-view'); await capture('mobile-controls');
  await evaluate('window.__ANIFOR_INPUT_AUDIT__.clear()');
  await search('water'); await click('[data-tool-key="material:2"] .material-button');
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  const touch = async () => {
    await evaluate('document.querySelector(".viewport").scrollIntoView({block:"center"})');
    const p=await evaluate('window.__ANIFOR_INPUT_AUDIT__.worldToScreen(306,192)');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...p,radiusX:2,radiusY:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await touch();
  check('mobile touch paints native Water at the mapped cell',await evaluate('window.__ANIFOR_INPUT_AUDIT__.cell(306,192)===2'));
  await click('[data-erase="true"]'); await touch();
  check('mobile Eraser works with touch',await evaluate('window.__ANIFOR_INPUT_AUDIT__.cell(306,192)===0'));
  check('no browser or shader errors',errors.length===0);
  report.passed=true;
} finally {
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await page?.close(); await host.teardown(); await server?.close();
}
