import { Mesh, MeshPhysicalMaterial, type PerspectiveCamera, type Scene, type WebGLRenderer, type WebGLRenderTarget, Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Transparent liquids/glass and the editing cursor must not act as opaque AO blockers. */
class MaterialAmbientOcclusion extends GTAOPass {
  override render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget): void {
    const hidden: Mesh[] = [];
    this.scene.traverse(object => {
      if (!(object instanceof Mesh) || !object.visible) return;
      const material = object.material;
      if (object.userData.excludeFromAO || (material instanceof MeshPhysicalMaterial && material.transmission > 0.5)) {
        hidden.push(object); object.visible = false;
      }
    });
    try { super.render(renderer, write, read, 0, false); }
    finally { for (const object of hidden) object.visible = true; }
  }
}

/** Bounded HDR finishing: half-resolution contact occlusion, restrained glow, final color conversion. */
export class StudioPostprocess {
  private readonly composer: EffectComposer;
  private readonly ao: MaterialAmbientOcclusion;
  constructor(private readonly renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    this.composer = new EffectComposer(renderer);
    this.composer.renderTarget1.samples = this.composer.renderTarget2.samples = 2;
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new MaterialAmbientOcclusion(scene, camera);
    this.ao.blendIntensity = 0.65;
    this.ao.updateGtaoMaterial({radius: 18, thickness: 12, distanceExponent: 1.4, distanceFallOff: 0.7, samples: 8});
    this.ao.updatePdMaterial({radius: 4, rings: 2, samples: 8});
    this.composer.addPass(this.ao);
    this.composer.addPass(new UnrealBloomPass(new Vector2(512, 512), 0.14, 0.45, 2.2));
    this.composer.addPass(new OutputPass());
  }
  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    const ratio = this.renderer.getPixelRatio();
    this.ao.setSize(Math.max(1, Math.floor(width * ratio / 2)), Math.max(1, Math.floor(height * ratio / 2)));
  }
  render(): void { this.composer.render(); }
  dispose(): void {
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
  }
}
