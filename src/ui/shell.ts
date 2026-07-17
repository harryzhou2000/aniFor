import type { AppIntent } from "../app/contracts";
import type { Tool } from "../input";

export type ShellAction = "step" | "recover";
export interface ShellOptions {
  readonly target: HTMLElement;
  readonly onAppIntent: (intent: AppIntent) => void;
  readonly onAction?: (action: ShellAction) => void;
  readonly initialTool?: Tool;
  readonly initialPaused?: boolean;
}

export interface SandboxShell {
  readonly surface: HTMLElement;
  getTool(): Tool;
  getBrushRadius(): number;
  setPaused(paused: boolean): void;
  setStatus(message: string): void;
  setRecoveryAvailable(available: boolean): void;
  setBrushPreview(preview: { readonly x: number; readonly y: number; readonly radius: number } | null): void;
  setRendererState(state: "ready" | "unsupported" | "error", message?: string): void;
  destroy(): void;
}

const tools: ReadonlyArray<{ id: Tool; label: string; glyph: string }> = [
  { id: "wall", label: "Wall", glyph: "▦" }, { id: "sand", label: "Sand", glyph: "◒" },
  { id: "water", label: "Water", glyph: "≈" }, { id: "fire", label: "Fire", glyph: "♨" },
  { id: "eraser", label: "Erase", glyph: "⌫" }
];

/** The shell only emits semantic actions; scheduler and simulation ownership stay with app/. */
export function mountSandboxShell(options: ShellOptions): SandboxShell {
  let selected = options.initialTool ?? "sand";
  let paused = options.initialPaused ?? false;
  options.target.innerHTML = `
    <section class="sandbox-shell" aria-label="Particle sandbox">
      <header class="sandbox-header"><div><p class="eyebrow">A quiet physics study</p><h1>Powder garden</h1></div><p class="status" role="status">Preparing the canvas…</p></header>
      <div class="sandbox-stage"><div class="canvas-surface" tabindex="0" aria-label="Sandbox canvas. Drag to paint. Use two fingers to pan and zoom." aria-describedby="canvas-help"><span id="canvas-help" class="visually-hidden">Press Escape to cancel an active stroke or gesture.</span><div class="brush-preview" aria-hidden="true"></div><div class="canvas-message">Starting renderer…</div></div></div>
      <footer class="sandbox-controls"><div class="tool-row" role="toolbar" aria-label="Materials">${tools.map((tool) => `<button class="tool-button ${tool.id === selected ? "is-selected" : ""}" type="button" data-tool="${tool.id}" aria-pressed="${tool.id === selected}"><span aria-hidden="true">${tool.glyph}</span><span>${tool.label}</span></button>`).join("")}</div><div class="control-row"><label class="brush-control" for="brush-size">Brush <output>3</output><input id="brush-size" type="range" min="1" max="12" value="3" /></label><button class="round-action pause-button" type="button" aria-pressed="false" aria-label="Pause simulation">Ⅱ</button><button class="round-action" type="button" data-action="step" aria-label="Advance one step">›</button><button class="text-action recovery-action" type="button" data-action="recover" hidden disabled>Recover</button><button class="text-action clear-action" type="button" data-action="clear">Clear</button></div></footer>
    </section>`;
  const root = options.target.querySelector<HTMLElement>(".sandbox-shell")!;
  const surface = root.querySelector<HTMLElement>(".canvas-surface")!;
  const status = root.querySelector<HTMLElement>(".status")!;
  const message = root.querySelector<HTMLElement>(".canvas-message")!;
  const brushPreview = root.querySelector<HTMLElement>(".brush-preview")!;
  const brush = root.querySelector<HTMLInputElement>("#brush-size")!;
  const brushOutput = root.querySelector<HTMLOutputElement>("output")!;
  const pauseButton = root.querySelector<HTMLButtonElement>(".pause-button")!;
  const onClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    const tool = button.dataset.tool as Tool | undefined;
    if (tool) {
      selected = tool;
      root.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((candidate) => {
        const active = candidate.dataset.tool === selected;
        candidate.classList.toggle("is-selected", active); candidate.setAttribute("aria-pressed", String(active));
      });
      status.textContent = `${tools.find((item) => item.id === tool)?.label ?? "Material"} selected.`;
      return;
    }
    if (button.classList.contains("pause-button")) { paused = !paused; updatePause(); options.onAppIntent({ type: "pause", paused }); }
    if (button.dataset.action === "step") options.onAction?.("step");
    if (button.dataset.action === "clear") { status.textContent = "Clearing the garden…"; options.onAppIntent({ type: "clear" }); }
    if (button.dataset.action === "recover") options.onAction?.("recover");
  };
  const updatePause = (): void => {
    pauseButton.textContent = paused ? "▶" : "Ⅱ";
    pauseButton.setAttribute("aria-label", paused ? "Play simulation" : "Pause simulation");
    pauseButton.setAttribute("aria-pressed", String(paused));
    status.textContent = paused ? "Paused — paint or advance one step." : "Running — drag to place material.";
  };
  const onBrush = (): void => { brushOutput.value = brush.value; };
  root.addEventListener("click", onClick); brush.addEventListener("input", onBrush); updatePause();
  return {
    surface,
    getTool: () => selected,
    getBrushRadius: () => Number(brush.value),
    setPaused(next): void { paused = next; updatePause(); },
    setStatus(next): void { status.textContent = next; },
    setRecoveryAvailable(available): void {
      const recovery = root.querySelector<HTMLButtonElement>(".recovery-action")!;
      recovery.hidden = !available; recovery.disabled = !available;
      if (available) status.textContent = "Cleared — recovery is available.";
    },
    setBrushPreview(next): void {
      if (!next) { brushPreview.classList.remove("is-visible"); return; }
      const diameter = Math.max(8, next.radius * 2 + 2);
      brushPreview.style.width = `${diameter}px`; brushPreview.style.height = `${diameter}px`;
      brushPreview.style.transform = `translate(${next.x - diameter / 2}px, ${next.y - diameter / 2}px)`;
      brushPreview.classList.add("is-visible");
    },
    setRendererState(state, detail): void {
      if (state === "ready") { message.remove(); status.textContent = "Running — drag to place material."; return; }
      surface.classList.add("is-unavailable");
      message.textContent = detail ?? "This browser cannot start the renderer.";
      status.textContent = state === "unsupported" ? "WebGL is unavailable." : "Renderer unavailable.";
    },
    destroy(): void { root.removeEventListener("click", onClick); brush.removeEventListener("input", onBrush); root.remove(); }
  };
}
