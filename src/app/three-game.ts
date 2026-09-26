import { MATERIALS, Material } from '../shared/materials';
import { exportWorldFile, importWorldFile, MAX_WORLD_FILE_BYTES, worldFileName } from '../shared/world-file';
import { createSimulation } from '../simulation';
import type { SimulationBackend } from '../simulation/types';
import { ThreeFieldRenderer } from '../renderer/three/three-field-renderer';
import { mountRenderModeSwitch, WORLD_STORAGE_KEY } from './render-mode';
import './three-studio.css';

export async function startThreeGame(root: HTMLElement): Promise<void> {
  root.dataset.renderMode = '3d';
  root.innerHTML = `
    <section class="studio-shell">
      <header class="studio-header"><div><p class="eyebrow">THE POWDER TOY · A NEW DIMENSION</p><h1>AniforTPT <span>Studio</span></h1></div><div class="studio-mode-host"></div></header>
      <main class="studio-workspace">
        <section class="studio-stage" aria-label="3D simulation viewport">
          <div class="studio-scene-label"><span class="studio-live-dot"></span><span>Particle studio</span><span class="studio-state">Live</span></div>
          <div class="studio-canvas-host"></div>
          <div class="studio-camera"><button data-camera="orbit" aria-pressed="true">Orbit</button><button data-camera="draw" aria-pressed="false">Draw</button><button data-camera="erase" aria-pressed="false">Erase</button><span></span><button data-action="front">Front</button><button data-action="reset-camera">Reset view</button></div>
          <p class="studio-gesture">Drag to orbit · scroll to zoom · right-drag to pan</p>
        </section>
        <aside class="studio-tools" aria-label="3D studio controls">
          <div class="studio-section-heading"><p class="eyebrow">BUILD SOMETHING</p><h2>Materials</h2></div>
          <input class="studio-search" type="search" placeholder="Find a material…" aria-label="Find a material">
          <div class="studio-palette" role="group" aria-label="Materials"></div>
          <label class="studio-brush">Brush size <output>7</output><input type="range" min="1" max="24" value="7" aria-label="Brush size"></label>
          <div class="studio-actions"><button data-action="pause">Pause</button><button data-action="step">Step</button><button data-action="save">Save file</button><button data-action="open">Open file</button><button data-action="demo">Load demo</button><button data-action="clear">Clear world</button></div>
          <input class="studio-file" type="file" accept=".cps,.anifortpt" hidden>
          <p class="studio-notice" role="status" aria-live="polite">Loading simulation…</p>
          <p class="studio-explanation">An open material world. Orbit to explore its depth; draw and erase on visible surfaces.</p>
        </aside>
      </main>
      <footer class="studio-footer"><span class="studio-backend"></span><span class="studio-stats"></span><a href="./NOTICE.txt" target="_blank" rel="license">GPLv3 · source notice</a></footer>
    </section>`;
  const find = <T extends HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector); if (!element) throw new Error(`Missing studio element ${selector}`); return element;
  };
  const notice = find('.studio-notice');
  const simulation = await createSimulation();
  let paused = new URLSearchParams(location.search).get('paused') === '1';
  let material: Material = Material.Sand;
  let radius = 7;
  let interaction: 'orbit' | 'draw' | 'erase' = 'orbit';
  let renderFailed = false;
  let disposed = false, frameId = 0, lastFrame = performance.now(), accumulator = 0, lastStats = 0;
  const save = (): void => localStorage.setItem(WORLD_STORAGE_KEY, simulation.saveWorld());
  let restored = false;
  try {
    const saved = localStorage.getItem(WORLD_STORAGE_KEY);
    if (saved) { simulation.loadWorld(saved); restored = true; }
    else if (new URLSearchParams(location.search).has('handoff')) throw new Error('The world saved by the previous view is unavailable.');
  } catch (error) {
    notice.textContent = `Could not open the saved world: ${error instanceof Error ? error.message : String(error)} The stored save has been retained.`;
    // No automatic seed, clear, or autosave is allowed to overwrite a failed handoff.
    throw error;
  }
  mountRenderModeSwitch(find('.studio-mode-host'), '3d', simulation, () => paused);
  if (!restored) seedStudioScene(simulation);
  const renderer = new ThreeFieldRenderer(find('.studio-canvas-host'), simulation, message => { notice.textContent = message; });
  find('.studio-backend').textContent = simulation.name;
  notice.textContent = restored ? 'Your world is open in 3D.' : 'Choose Draw and a material to shape the world.';
  const setPaused = (value: boolean): void => {
    paused = value; accumulator = 0;
    find('[data-action="pause"]').textContent = value ? 'Resume' : 'Pause';
    find('.studio-state').textContent = value ? 'Paused' : 'Live';
  };
  setPaused(paused);
  const setInteraction = (value: typeof interaction): void => {
    cancelStroke();
    interaction = value; renderer.setDrawMode(value !== 'orbit');
    root.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.camera === value)));
    find('.studio-gesture').textContent = value === 'orbit' ? 'Drag to orbit · scroll to zoom · right-drag to pan' : `${value === 'draw' ? 'Draw' : 'Erase'} on visible surfaces · select Orbit to move the camera`;
  };
  const palette = find('.studio-palette');
  const favorites = new Set<number>([Material.Sand, Material.Water, Material.Stone, Material.Wood, Material.Fire, Material.Smoke, Material.Glass, Material.Metal, Material.Oil, Material.Lava, Material.Plant, Material.Ice]);
  const renderPalette = (search = ''): void => {
    palette.replaceChildren();
    const query = search.trim().toLowerCase();
    const choices = MATERIALS.filter(info => info.available !== false && (query ? `${info.name} ${info.description}`.toLowerCase().includes(query) : favorites.has(info.id)));
    for (const info of choices) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.material = String(info.id);
      button.setAttribute('aria-pressed', String(info.id === material)); button.title = info.description;
      const swatch = document.createElement('span'); swatch.className = 'studio-swatch'; swatch.style.setProperty('--material-color', info.color);
      const name = document.createElement('span'); name.textContent = info.name;
      button.append(swatch, name); button.addEventListener('click', () => {
        material = info.id; setInteraction('draw');
        palette.querySelectorAll<HTMLButtonElement>('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.material === String(material))));
        notice.textContent = `${info.name} · ${info.description}`;
      }); palette.append(button);
    }
    if (!choices.length) palette.textContent = 'No matching materials.';
  };
  renderPalette();
  find<HTMLInputElement>('.studio-search').addEventListener('input', event => renderPalette((event.target as HTMLInputElement).value));
  find<HTMLInputElement>('.studio-brush input').addEventListener('input', event => {
    radius = Number((event.target as HTMLInputElement).value); find('.studio-brush output').textContent = String(radius);
    renderer.showBrush(hoverPoint, radius);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => button.addEventListener('click', () => setInteraction(button.dataset.camera as typeof interaction)));
  const action = (name: string, callback: () => void): void => find(`[data-action="${name}"]`).addEventListener('click', callback);
  action('pause', () => setPaused(!paused));
  action('step', () => { setPaused(true); simulation.step(); renderer.invalidate(); });
  action('front', () => renderer.resetView(true)); action('reset-camera', () => renderer.resetView());
  action('clear', () => { simulation.clear(); renderer.invalidate(); try { save(); notice.textContent = 'World cleared.'; } catch { notice.textContent = 'World cleared; browser storage is unavailable.'; } });
  action('demo', () => { seedStudioScene(simulation); renderer.invalidate(); setPaused(true); renderer.resetView(); notice.textContent = 'Water, sand, glass and a small hearth. Press Resume to watch the native simulation.'; });
  action('save', () => {
    try {
      const file = exportWorldFile(simulation);
      const url = URL.createObjectURL(new Blob([file.bytes.slice().buffer], {type: file.mediaType}));
      const link = document.createElement('a'); link.href = url; link.download = worldFileName(file.extension); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); notice.textContent = 'World saved to file.';
    } catch (error) { notice.textContent = `Save failed: ${String(error)}`; }
  });
  const fileInput = find<HTMLInputElement>('.studio-file'); action('open', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    const before = simulation.saveWorld();
    setPaused(true);
    try {
      if (file.size > MAX_WORLD_FILE_BYTES) throw new Error('Save file is too large.');
      importWorldFile(simulation, new Uint8Array(await file.arrayBuffer()));
      renderer.invalidate(); setPaused(true); save(); notice.textContent = `Opened ${file.name}.`;
    } catch (error) {
      simulation.loadWorld(before); renderer.invalidate(); notice.textContent = `Open failed: ${error instanceof Error ? error.message : String(error)}`;
    } finally { fileInput.value = ''; }
  });
  let stroke: {id: number; erase: boolean; clientX?: number; clientY?: number; point?: {x: number; y: number}} | undefined;
  let hoverPoint: {x: number; y: number; z?: number} | undefined;
  function cancelStroke(): void {
    const previous = stroke; stroke = undefined;
    if (previous && renderer.canvas.hasPointerCapture(previous.id)) renderer.canvas.releasePointerCapture(previous.id);
    hoverPoint = undefined; renderer.showBrush(undefined, radius);
  }
  const applyBrush = (x: number, y: number, erase: boolean): void => {
    if (erase) { simulation.erase(x, y, radius); simulation.eraseWall?.(x, y, radius); }
    else simulation.paint(x, y, material, radius);
  };
  const paint = (event: PointerEvent): void => {
    if (stroke) { stroke.clientX = event.clientX; stroke.clientY = event.clientY; }
    const point = renderer.worldPoint(event.clientX, event.clientY);
    hoverPoint = point;
    renderer.showBrush(point, radius);
    if (!stroke || !point) { if (stroke) stroke.point = undefined; return; }
    const from = stroke.point ?? point;
    const steps = Math.max(1, Math.ceil(Math.hypot(point.x - from.x, point.y - from.y)));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(from.x + (point.x - from.x) * i / steps), y = Math.round(from.y + (point.y - from.y) * i / steps);
      applyBrush(x, y, stroke.erase);
    }
    stroke.point = point; renderer.invalidate();
  };
  renderer.canvas.addEventListener('pointerdown', event => {
    if (interaction === 'orbit' || stroke || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    stroke = {id: event.pointerId, erase: interaction === 'erase' || event.button === 2}; renderer.canvas.setPointerCapture(event.pointerId); paint(event);
  });
  renderer.canvas.addEventListener('pointermove', event => {
    if (stroke?.id === event.pointerId && event.buttons === 0) { cancelStroke(); return; }
    if (interaction !== 'orbit' && (!stroke || stroke.id === event.pointerId)) paint(event);
  });
  const finishStroke = (event: PointerEvent): void => {
    if (stroke?.id !== event.pointerId) return;
    // Browsers can deliver the release position without a final pointermove.
    // Keep the original button's operation: pointerup.buttons is already zero.
    if (event.type === 'pointerup' && (stroke.clientX !== event.clientX || stroke.clientY !== event.clientY)) paint(event);
    cancelStroke();
  };
  renderer.canvas.addEventListener('pointerup', finishStroke); renderer.canvas.addEventListener('pointercancel', finishStroke);
  renderer.canvas.addEventListener('lostpointercapture', event => { if (stroke?.id === event.pointerId) cancelStroke(); });
  renderer.canvas.addEventListener('pointerleave', () => { if (!stroke) { hoverPoint = undefined; renderer.showBrush(undefined, radius); } });
  window.addEventListener('blur', cancelStroke);
  renderer.canvas.addEventListener('contextmenu', event => event.preventDefault());
  const autosave = window.setInterval(() => { try { save(); } catch { /* An explicit save or mode switch reports failure. */ } }, 4000);
  const frame = (time: number): void => {
    if (disposed) return;
    const elapsed = Math.min(time - lastFrame, 80); lastFrame = time;
    if (!paused) {
      accumulator += elapsed;
      while (accumulator >= 1000 / 60) {
        // Hold a brush to pour or erase as matter moves through its native cell.
        if (stroke?.point) applyBrush(stroke.point.x, stroke.point.y, stroke.erase);
        simulation.step(); accumulator -= 1000 / 60;
      }
    }
    try { if (!renderFailed) renderer.render(time, !paused); }
    catch (error) { renderFailed = true; setPaused(true); notice.textContent = `Rendering stopped: ${String(error)} Switch to 2D to continue with this world.`; }
    if (time - lastStats > 500) {
      const stats = renderer.stats;
      find('.studio-stats').textContent = `${stats.particles.toLocaleString()} cells · ${stats.triangles.toLocaleString()} triangles`;
      lastStats = time;
    }
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  const dispose = (): void => { disposed = true; cancelAnimationFrame(frameId); clearInterval(autosave); window.removeEventListener('blur', cancelStroke); renderer.dispose(); };
  window.addEventListener('pagehide', dispose, {once: true});
  if (new URLSearchParams(location.search).get('inputAudit') === '1') {
    Object.assign(window, {__ANIFOR_3D_AUDIT__: {
      state: () => ({backend: simulation.name, paused, stats: renderer.stats, camera: renderer.camera.position.toArray(), target: renderer.controls.target.toArray(), world: simulation.saveWorld()}),
      project: (x: number, y: number, surface = true) => renderer.projectCell(x, y, surface),
      pick: (x: number, y: number) => renderer.worldPoint(x, y),
      cell: (x: number, y: number) => simulation.cells()[y * simulation.width + x],
      count: () => simulation.cells().reduce((total, id) => total + Number(id !== 0), 0),
      paint: (x: number, y: number, value: number, size: number) => { simulation.paint(x, y, value as Material, size); renderer.invalidate(); },
      wall: (x: number, y: number) => simulation.walls?.()[y * simulation.width + x],
      paintWall: (x: number, y: number, value: number, size: number) => { simulation.paintWall?.(x, y, value, size); renderer.invalidate(); },
      pause: setPaused, clear: () => { simulation.clear(); renderer.invalidate(); },
      step: () => { simulation.step(); renderer.invalidate(); },
    }});
  }
}

function seedStudioScene(simulation: SimulationBackend): void {
  simulation.clear();
  const {width, height} = simulation;
  const rect = (x0: number, y0: number, x1: number, y1: number, material: Material): void => {
    for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) simulation.paint(x, y + 24, material, 0);
  };
  rect(35, height - 38, width - 35, height - 28, Material.Metal);
  rect(190, height - 145, 199, height - 38, Material.Glass);
  rect(365, height - 145, 374, height - 38, Material.Glass);
  rect(199, height - 47, 365, height - 38, Material.Glass);
  rect(201, height - 126, 363, height - 49, Material.Water);
  for (let y = height - 130; y < height - 39; y++) {
    const spread = Math.min(78, (y - height + 130) * 0.9);
    rect(110 - spread, y, 110 + spread, y + 1, Material.Sand);
  }
  rect(435, height - 90, 460, height - 38, Material.Wood);
  simulation.paint(447, height - 76, Material.Fire, 12);
  simulation.paint(450, height - 131, Material.Smoke, 17);
  simulation.paint(120, height - 186, Material.Sand, 11);
}
