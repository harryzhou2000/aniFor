import type { AppIntent } from "../app/contracts";
import type { Tool } from "../input";

export type ShellAction = "step" | "recover";
export interface ShellOptions {
  readonly target: HTMLElement;
  readonly onAppIntent: (intent: AppIntent) => void;
  readonly onAction?: (action: ShellAction) => void;
  readonly onExportFile?: () => void;
  readonly onImportFile?: (file: File) => void;
  readonly onExportText?: () => void;
  readonly onImportText?: (text: string) => void;
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
  setSaveText(text: string): void;
  setBrushPreview(preview: { readonly cells: readonly { readonly x: number; readonly y: number; readonly size: number }[] } | null): void;
  setRendererState(state: "ready" | "unsupported" | "error", message?: string): void;
  destroy(): void;
}

const tools: ReadonlyArray<{ id: Tool; label: string; glyph: string }> = [
  { id: "wall", label: "Wall", glyph: "▦" }, { id: "sand", label: "Sand", glyph: "◒" },
  { id: "water", label: "Water", glyph: "≈" }, { id: "oil", label: "Oil", glyph: "●" },
  { id: "fire", label: "Fire", glyph: "♨" }, { id: "wood", label: "Wood", glyph: "║" },
  { id: "ice", label: "Ice", glyph: "◇" }, { id: "acid", label: "Acid", glyph: "⊗" },
  { id: "eraser", label: "Erase", glyph: "⌫" }
];

/** The shell only emits semantic actions; scheduler and simulation ownership stay with app/. */
export function mountSandboxShell(options: ShellOptions): SandboxShell {
  let selected = options.initialTool ?? "sand";
  let paused = options.initialPaused ?? false;
  options.target.innerHTML = `
    <section class="sandbox-shell" aria-label="Particle sandbox">
      <header class="sandbox-header"><div><p class="eyebrow">A quiet physics study</p><h1>Powder garden</h1></div><p class="status" role="status">Preparing the canvas…</p></header>
      <div class="sandbox-stage"><div class="world-bed"><div class="canvas-surface" tabindex="0" aria-label="256 by 192 sandbox world. Drag to paint. Use two fingers to pan and zoom." aria-describedby="canvas-help"><span id="canvas-help" class="visually-hidden">Press Escape to cancel an active stroke or gesture.</span><div class="brush-preview" aria-hidden="true"></div><div class="canvas-message">Starting renderer…</div></div></div></div>
      <footer class="sandbox-controls"><div class="tool-row" role="toolbar" aria-label="Materials">${tools.map((tool) => `<button class="tool-button ${tool.id === selected ? "is-selected" : ""}" type="button" data-tool="${tool.id}" aria-pressed="${tool.id === selected}"><span aria-hidden="true">${tool.glyph}</span><span>${tool.label}</span></button>`).join("")}</div><div class="action-stack"><div class="control-row"><label class="brush-control" for="brush-size">Brush <output>3</output><input id="brush-size" type="range" min="1" max="12" value="3" /></label><button class="round-action pause-button" type="button" aria-pressed="false" aria-label="Pause simulation">Ⅱ</button><button class="round-action" type="button" data-action="step" aria-label="Advance one step">›</button><button class="text-action recovery-action" type="button" data-action="recover" hidden disabled>Recover</button><button class="text-action clear-action" type="button" data-action="clear">Clear</button></div><button class="persistence-toggle" type="button" data-action="persistence" aria-controls="persistence-panel" aria-expanded="false">Save / load</button></div><section id="persistence-panel" class="persistence-panel" hidden aria-label="Save and load"><div class="persistence-heading"><p class="eyebrow">Keep this garden</p><p>Save a file, or use a code without adding anything to your browser history.</p></div><div class="persistence-file-row"><button class="text-action" type="button" data-action="export-file">Export file</button><button class="text-action" type="button" data-action="import-file">Import file</button><input class="visually-hidden" type="file" data-save-file tabindex="-1" aria-label="Choose a sandbox save file" /></div><label class="save-code-label" for="save-code">Save code</label><textarea id="save-code" class="save-code" rows="3" spellcheck="false" autocomplete="off" aria-describedby="save-code-help" placeholder="Generated save code appears here. Paste a code here to load it."></textarea><p id="save-code-help" class="save-code-help">Save codes stay on this device until you copy or paste them.</p><div class="persistence-code-row"><button class="text-action" type="button" data-action="export-text">Create code</button><button class="text-action" type="button" data-action="import-text">Load code</button></div></section></footer>
    </section>`;
  const root = options.target.querySelector<HTMLElement>(".sandbox-shell")!;
  const surface = root.querySelector<HTMLElement>(".canvas-surface")!;
  const status = root.querySelector<HTMLElement>(".status")!;
  const message = root.querySelector<HTMLElement>(".canvas-message")!;
  const brushPreview = root.querySelector<HTMLElement>(".brush-preview")!;
  const brush = root.querySelector<HTMLInputElement>("#brush-size")!;
  const brushOutput = root.querySelector<HTMLOutputElement>("output")!;
  const pauseButton = root.querySelector<HTMLButtonElement>(".pause-button")!;
  const persistencePanel = root.querySelector<HTMLElement>(".persistence-panel")!;
  const persistenceToggle = root.querySelector<HTMLButtonElement>(".persistence-toggle")!;
  const fileInput = root.querySelector<HTMLInputElement>("[data-save-file]")!;
  const saveCode = root.querySelector<HTMLTextAreaElement>("#save-code")!;
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
    if (button.dataset.action === "persistence") {
      persistencePanel.hidden = !persistencePanel.hidden;
      persistenceToggle.setAttribute("aria-expanded", String(!persistencePanel.hidden));
    }
    if (button.dataset.action === "export-file") options.onExportFile?.();
    if (button.dataset.action === "import-file") fileInput.click();
    if (button.dataset.action === "export-text") options.onExportText?.();
    if (button.dataset.action === "import-text") options.onImportText?.(saveCode.value);
  };
  const onFileChange = (): void => {
    const file = fileInput.files?.item(0);
    if (file) options.onImportFile?.(file);
    fileInput.value = "";
  };
  const updatePause = (): void => {
    pauseButton.textContent = paused ? "▶" : "Ⅱ";
    pauseButton.setAttribute("aria-label", paused ? "Play simulation" : "Pause simulation");
    pauseButton.setAttribute("aria-pressed", String(paused));
    status.textContent = paused ? "Paused — paint or advance one step." : "Running — drag to place material.";
  };
  const onBrush = (): void => { brushOutput.value = brush.value; };
  root.addEventListener("click", onClick); brush.addEventListener("input", onBrush); fileInput.addEventListener("change", onFileChange); updatePause();
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
    setSaveText(text): void {
      saveCode.value = text;
      if (text) status.textContent = "Save code ready to copy.";
    },
    setBrushPreview(next): void {
      if (!next) { brushPreview.classList.remove("is-visible"); return; }
      brushPreview.replaceChildren(...next.cells.map((cell) => {
        const square = document.createElement("span");
        square.className = "brush-preview-cell";
        square.style.transform = `translate(${cell.x}px, ${cell.y}px)`;
        square.style.width = `${cell.size}px`; square.style.height = `${cell.size}px`;
        return square;
      }));
      brushPreview.classList.add("is-visible");
    },
    setRendererState(state, detail): void {
      if (state === "ready") { message.remove(); status.textContent = "Running — drag to place material."; return; }
      surface.classList.add("is-unavailable");
      message.textContent = detail ?? "This browser cannot start the renderer.";
      status.textContent = state === "unsupported" ? "WebGL is unavailable." : "Renderer unavailable.";
    },
    destroy(): void { root.removeEventListener("click", onClick); brush.removeEventListener("input", onBrush); fileInput.removeEventListener("change", onFileChange); root.remove(); }
  };
}
