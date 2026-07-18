import { Application, Container, Sprite, Texture } from 'pixi.js';

/** GPU presentation for a Canvas2D material field; physics and shading stay independent. */
export class PixiFieldPresenter {
  private readonly app = new Application();
  private readonly scene = new Container();
  private readonly texture: Texture;

  private constructor(private readonly host: HTMLElement, source: HTMLCanvasElement) {
    this.texture = Texture.from(source);
    // Smooth GPU interpolation keeps the native field from becoming a grid of
    // enlarged texels when the world is fitted to a desktop viewport.
    this.texture.source.scaleMode = 'linear';
    this.scene.addChild(new Sprite(this.texture));
  }

  static async create(host: HTMLElement, source: HTMLCanvasElement): Promise<PixiFieldPresenter> {
    const presenter = new PixiFieldPresenter(host, source);
    await presenter.app.init({
      resizeTo: host,
      preference: 'webgl',
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoStart: false,
    });
    presenter.app.canvas.className = 'world-canvas';
    presenter.app.stage.addChild(presenter.scene);
    return presenter;
  }

  mount(): void { this.host.append(this.app.canvas); }
  update(): void { this.texture.source.update(); this.app.render(); }

  setTransform(scale: number, x: number, y: number): void {
    this.scene.scale.set(scale);
    this.scene.position.set(x, y);
    this.app.render();
  }
}
