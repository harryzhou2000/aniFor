import './styles.css';
import { Game } from './app/game';
import { renderLabRequested } from './renderer/render-lab-scene';
import { fitAspect } from './renderer/view-transform';
import { createSimulation } from './simulation';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing app root');

root.innerHTML = `
  <section class="shell">
    <header class="topbar">
      <div><p class="eyebrow">THE POWDER TOY, REIMAGINED</p><h1>AniforTPT</h1></div>
      <p class="hint">Draw · wheel to zoom · right-click to erase</p>
    </header>
    <section class="workspace">
      <div class="viewport-frame">
        <section class="viewport" aria-label="Particle simulation canvas">
          <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div><p class="touch-hint">Drag to pan · pinch to zoom</p>
        </section>
      </div>
      <aside class="toolbox" aria-label="Simulation tools">
        <div class="toolbox-heading"><p class="eyebrow">MATERIAL LAB</p><p>Shape the world</p></div>
      </aside>
    </section>
    <footer class="footer"><p class="status">Deterministic simulation · saved on this device</p><a href="./NOTICE.txt" target="_blank" rel="license">GPLv3 · source notice</a></footer>
  </section>`;

const simulation = await createSimulation({ renderLab: renderLabRequested() });
const viewportFrame = root.querySelector<HTMLElement>('.viewport-frame');
const viewport = root.querySelector<HTMLElement>('.viewport');
if (!viewportFrame || !viewport) throw new Error('Missing simulation viewport');
const fitViewport = (): void => {
  const size = fitAspect(viewportFrame.clientWidth, viewportFrame.clientHeight, simulation.width / simulation.height);
  viewport.style.width = size.width + 'px';
  viewport.style.height = size.height + 'px';
  viewport.dataset.aspect = simulation.width + ':' + simulation.height;
};
new ResizeObserver(fitViewport).observe(viewportFrame);
fitViewport();

root.querySelector('.status')!.textContent = `${simulation.name} · saved on this device`;
await new Game(root, simulation).start();
