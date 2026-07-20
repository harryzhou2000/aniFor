import type { Point } from '../renderer/view-transform';
import type {
  NativeSign, NativeSignDraft, NativeSignJustification, SimulationBackend,
} from '../simulation';

const SIGN_HEIGHT = 15;
const SIGN_TOP_OFFSET = 18;
const SIGN_BOTTOM_OFFSET = 4;
const APPROXIMATE_CHARACTER_WIDTH = 6;
const SIGN_REFRESH_INTERVAL = 100;

export interface SignProjector {
  worldToScreen(x: number, y: number): Point;
}

/** TPT-compatible world-space label hit testing, independent of particle occupancy. */
export function hitTestNativeSign(
  signs: readonly NativeSign[], point: Point,
): NativeSign | undefined {
  for (let index = signs.length - 1; index >= 0; index--) {
    const sign = signs[index];
    const width = Math.max(4, sign.displayText.length * APPROXIMATE_CHARACTER_WIDTH + 4);
    const left = sign.justification === 2 ? sign.x - width
      : sign.justification === 0 ? sign.x : sign.x - width / 2;
    const top = sign.y > SIGN_TOP_OFFSET ? sign.y - SIGN_TOP_OFFSET : sign.y + SIGN_BOTTOM_OFFSET;
    if (point.x >= left && point.x <= left + width
      && point.y >= top && point.y <= top + SIGN_HEIGHT) return sign;
    if (Math.hypot(point.x - sign.x, point.y - sign.y) <= 4) return sign;
  }
  return undefined;
}

/** DOM presentation for native signs; it owns neither cells nor render textures. */
export class NativeSignOverlay {
  private readonly overlay = document.createElement('div');
  private readonly labels = new Map<number, HTMLElement>();
  private signature = '';
  private signsSnapshot: readonly NativeSign[] = [];
  private lastRefresh = -Infinity;

  constructor(
    private readonly host: HTMLElement,
    private readonly simulation: SimulationBackend,
    private readonly projector: SignProjector,
  ) {
    this.overlay.className = 'native-sign-overlay';
    this.overlay.setAttribute('aria-label', 'World annotations');
    host.append(this.overlay);
  }

  render(time = performance.now()): void {
    if (time - this.lastRefresh >= SIGN_REFRESH_INTERVAL) {
      this.lastRefresh = time;
      this.signsSnapshot = this.simulation.signs?.() ?? [];
    }
    const signs = this.signsSnapshot;
    const signature = signs.map((sign) => [
      sign.index, sign.x, sign.y, sign.justification, sign.displayText,
    ].join(':')).join('\n');
    if (signature !== this.signature) {
      this.signature = signature;
      this.labels.clear();
      this.overlay.replaceChildren();
      for (const sign of signs) {
        const label = document.createElement('span');
        label.className = 'native-sign';
        label.dataset.signIndex = String(sign.index);
        label.dataset.justification = String(sign.justification);
        label.textContent = sign.displayText;
        this.labels.set(sign.index, label);
        this.overlay.append(label);
      }
    }
    const hostBounds = this.host.getBoundingClientRect();
    for (const sign of signs) {
      const label = this.labels.get(sign.index);
      if (!label) continue;
      const point = this.projector.worldToScreen(sign.x, sign.y);
      label.style.left = `${point.x - hostBounds.left}px`;
      label.style.top = `${point.y - hostBounds.top}px`;
      label.classList.toggle('native-sign-below', sign.y <= SIGN_TOP_OFFSET);
    }
  }
}

/** One compact editor shared by mouse, touch, and imported native signs. */
export class NativeSignEditor {
  private readonly dialog = document.createElement('dialog');
  private readonly form = document.createElement('form');
  private readonly input = document.createElement('input');
  private readonly justification = document.createElement('select');
  private readonly position = document.createElement('output');
  private readonly error = document.createElement('output');
  private readonly remove = document.createElement('button');
  private point: Point = { x: 0, y: 0 };
  private editing?: NativeSign;

  constructor(private readonly simulation: SimulationBackend, maximumLength = 45) {
    this.dialog.className = 'native-sign-editor glass';
    this.dialog.setAttribute('aria-labelledby', 'native-sign-editor-title');
    this.form.method = 'dialog';
    this.form.innerHTML = '<h2 id="native-sign-editor-title">World sign</h2>';

    const textLabel = document.createElement('label');
    textLabel.textContent = 'Text';
    this.input.type = 'text';
    this.input.maxLength = maximumLength;
    this.input.placeholder = 'Message or {temp}, {p}, {type}…';
    this.input.autocomplete = 'off';
    textLabel.append(this.input);

    const pointerLabel = document.createElement('label');
    pointerLabel.textContent = 'Pointer';
    for (const [value, label] of [['0', 'Left'], ['1', 'Middle'], ['2', 'Right'], ['3', 'None']] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.justification.append(option);
    }
    pointerLabel.append(this.justification);
    this.position.className = 'native-sign-position';
    this.error.className = 'native-sign-error';
    this.error.setAttribute('aria-live', 'polite');

    const actions = document.createElement('div');
    actions.className = 'native-sign-editor-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.close());
    this.remove.type = 'button';
    this.remove.className = 'native-sign-remove';
    this.remove.textContent = 'Delete';
    this.remove.addEventListener('click', () => {
      if (this.editing && this.simulation.removeSign?.(this.editing.index)) this.close();
    });
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'native-sign-save';
    save.textContent = 'Save';
    actions.append(cancel, this.remove, save);
    this.form.append(textLabel, pointerLabel, this.position, this.error, actions);
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const draft: NativeSignDraft = {
        x: this.point.x,
        y: this.point.y,
        justification: Number(this.justification.value) as NativeSignJustification,
        text: this.input.value,
      };
      const result = this.simulation.upsertSign?.(draft, this.editing?.index) ?? -1;
      if (result >= 0) this.close();
      else this.error.value = this.input.value ? 'Could not save sign (the 16-sign limit may be full).' : 'Enter sign text.';
    });
    this.dialog.addEventListener('cancel', (event) => { event.preventDefault(); this.close(); });
    this.dialog.append(this.form);
    document.body.append(this.dialog);
  }

  get isOpen(): boolean { return this.dialog.open; }

  open(point: Point, existing?: NativeSign): void {
    if (this.isOpen) return;
    this.editing = existing;
    this.point = existing ? { x: existing.x, y: existing.y } : point;
    this.input.value = existing?.text ?? '';
    this.justification.value = String(existing?.justification ?? 1);
    this.position.value = `${this.point.x}, ${this.point.y}`;
    this.remove.hidden = !existing;
    this.error.value = '';
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
    this.input.focus();
  }

  private close(): void {
    if (typeof this.dialog.close === 'function') this.dialog.close();
    else this.dialog.removeAttribute('open');
    this.editing = undefined;
  }
}
