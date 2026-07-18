import './styles.css';
import { Game } from './app/game';
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
      <section class="viewport" aria-label="Particle simulation canvas">
        <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div><p class="touch-hint">Pinch to explore · hold to erase</p>
      </section>
      <aside class="toolbox" aria-label="Simulation tools">
        <div class="toolbox-heading"><p class="eyebrow">MATERIAL LAB</p><p>Shape the world</p></div>
      </aside>
    </section>
    <footer class="footer"><p class="status">Deterministic simulation · saved on this device</p><a href="./NOTICE.txt" target="_blank" rel="license">GPLv3 · source notice</a></footer>
  </section>`;

const simulation = await createSimulation();
root.querySelector('.status')!.textContent = `${simulation.name} · saved on this device`;
await new Game(root, simulation).start();
