import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ALL_MATERIALS, Material, type MaterialInfo } from '../../shared/materials';
import type { SimulationBackend } from '../../simulation/types';
import { renderPhase, RenderPhase } from '../render-profile';
import { contourContains, materialContours } from './material-contours';
import { powderSupport, powderVolumeGeometry } from './powder-volume';
import { StudioPostprocess } from './studio-postprocess';
import { studioTextures } from './studio-textures';
import { studioEnvironment } from './studio-environment';

interface Bucket {
  indices: number[]; hash: number; minX: number; minY: number; maxX: number; maxY: number;
}
interface Body { group: THREE.Group; hash: number; instances?: THREE.InstancedMesh; surface?: THREE.Mesh; mist?: THREE.Points; denseCells?: number }
const WALL_ID = 256;
const METALS = new Set<number>([Material.Metal, Material.GOLD, Material.IRON, Material.TTAN, Material.PTNM, Material.BMTL, Material.BRMT, Material.Mercury]);
const infos = new Map<number, MaterialInfo>(ALL_MATERIALS.map(info => [info.id, info]));

/** Real 3D geometry reconstructed from the native simulation's upright plane. */
export class ThreeFieldRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly controls: OrbitControls;
  readonly camera = new THREE.PerspectiveCamera(42, 1, 1, 12000);
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly bodies = new Map<number, Body>();
  private readonly materials = new Map<number, THREE.Material>();
  private readonly grain = new THREE.IcosahedronGeometry(0.67, 0);
  private readonly voxel = new THREE.BoxGeometry(1, 1, 84);
  private readonly drop = new THREE.SphereGeometry(0.72, 8, 6);
  private readonly matrix = new THREE.Matrix4();
  private readonly pointer = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly hit = new THREE.Vector3();
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly softTexture: THREE.CanvasTexture;
  private readonly textures = studioTextures();
  private postprocess?: StudioPostprocess;
  private shadowsDirty = true;
  private ground!: THREE.Mesh;
  private readonly sourceLight = new THREE.PointLight(0xffa04c, 0, 230, 1.3);
  private readonly brush: THREE.Mesh;
  private readonly resizeObserver: ResizeObserver;
  private lastRefresh = -Infinity;
  private lastControlUpdate = performance.now();
  private interactionUntil = 0;
  private interactiveFrame = false;
  private invalidated = true;
  private viewChanged = true;
  private disposed = false;
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.failed?.('The 3D graphics context was lost. Your world is still available; switch to 2D or reload.');
  };
  private readonly onContextRestored = (): void => { this.invalidated = this.shadowsDirty = true; this.failed?.('Graphics restored.'); };
  stats = { particles: 0, bodies: 0, triangles: 0, reconstructionMs: 0, drawCalls: 0, densePowderCells: 0, looseGrains: 0 };

  constructor(
    private readonly host: HTMLElement, private readonly simulation: SimulationBackend,
    private readonly failed?: (message: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene.background = new THREE.Color(0x14232c);
    this.scene.fog = new THREE.Fog(0x14232c, 1400, 6500);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'three-field-canvas';
    this.canvas.dataset.renderer = 'three-webgl';
    this.canvas.setAttribute('aria-label', '3D particle world');
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    host.append(this.canvas);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 90;
    this.controls.maxDistance = 1400;
    // Full orbit: the scene has no rear board or enclosing box.
    this.controls.minPolarAngle = Math.PI * 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.5;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.scene.add(new THREE.HemisphereLight(0xd9efff, 0x84634c, 0.3));
    const key = new THREE.DirectionalLight(0xffeedb, 2.4);
    key.position.set(-240, 420, 300);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 3;
    key.shadow.camera.left = -400; key.shadow.camera.right = 400;
    key.shadow.camera.top = 350; key.shadow.camera.bottom = -350;
    key.shadow.camera.far = 1200;
    key.shadow.normalBias = 0.5;
    const rim = new THREE.DirectionalLight(0xa5cde7, 1.1);
    rim.position.set(240, 180, -260);
    this.scene.add(key, rim, this.sourceLight);
    const generator = new THREE.PMREMGenerator(this.renderer);
    const environment = studioEnvironment();
    this.environment = generator.fromEquirectangular(environment);
    this.scene.environment = this.environment.texture;
    environment.dispose(); generator.dispose();
    const texture = document.createElement('canvas'); texture.width = texture.height = 64;
    const context = texture.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#ffffffff'); gradient.addColorStop(0.35, '#ffffffb0'); gradient.addColorStop(1, '#ffffff00');
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    this.softTexture = new THREE.CanvasTexture(texture);
    this.addStage();
    this.brush = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd69a, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }));
    this.brush.userData.excludeFromAO = true;
    this.brush.renderOrder = 100; this.brush.visible = false; this.scene.add(this.brush);
    if (this.renderer.extensions.has('EXT_color_buffer_float')) {
      this.postprocess = new StudioPostprocess(this.renderer, this.scene, this.camera);
      this.canvas.dataset.postprocess = 'gtao-bloom';
    } else this.canvas.dataset.postprocess = 'direct';
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize(); this.resetView();
  }

  private addStage(): void {
    // This plane extends far past the camera's view and fades into the same
    // atmosphere as the background. Following camera X/Z keeps its edge out of
    // sight even after long pans. There is no rear panel or perimeter frame.
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000), new THREE.MeshStandardMaterial({ color: 0x14202a, roughness: 0.86, envMapIntensity: 0.12 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -this.simulation.height / 2 + 3.7;
    this.ground.receiveShadow = true; this.scene.add(this.ground);
  }

  private fitDistance(): number {
    return Math.max(this.simulation.height / 2, this.simulation.width / (2 * this.camera.aspect))
      / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.2;
  }

  resetView(front = false): void {
    const distance = this.fitDistance();
    this.viewChanged = true;
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false; this.controls.update();
    const targetY = front ? 0 : -this.simulation.height * 0.18;
    this.camera.position.set(front ? 0 : distance * 0.48, targetY + (front ? 0 : distance * 0.30), distance);
    this.controls.target.set(0, targetY, 0); this.controls.update(); this.controls.enableDamping = damping;
  }

  setDrawMode(draw: boolean): void {
    this.controls.enabled = !draw; this.controls.enableDamping = !draw;
    if (draw) this.controls.update(); // Finish orbit inertia before a drawing stroke.
    else this.brush.visible = false;
    this.viewChanged = true;
  }
  invalidate(): void { this.invalidated = true; }
  private pickableMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const body of this.bodies.values()) {
      if (body.surface) meshes.push(body.surface);
      if (body.instances?.count) meshes.push(body.instances);
    }
    return meshes;
  }

  worldPoint(clientX: number, clientY: number): { x: number; y: number; z: number } | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.camera.updateMatrixWorld(); this.scene.updateMatrixWorld(true);
    this.ray.setFromCamera(this.pointer, this.camera);
    // Pick the visible body first. Intersecting z=0 through a thick body shifts
    // the edit sideways when viewed obliquely, often erasing an adjacent cell.
    const intersection = this.ray.intersectObjects(this.pickableMeshes(), false)[0];
    if (intersection) {
      this.hit.copy(intersection.point);
      const instanceCells = intersection.object.userData.cells as readonly number[] | undefined;
      if (intersection.instanceId !== undefined && instanceCells) {
        const index = instanceCells[intersection.instanceId];
        return {x: index % this.simulation.width, y: Math.floor(index / this.simulation.width), z: this.hit.z};
      }
    } else if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return;
    let x = Math.floor(this.hit.x + this.simulation.width / 2);
    let y = Math.floor(this.simulation.height / 2 - this.hit.y);
    // Extrusion bevels protrude fractionally past native cell ownership.
    if (intersection) {
      const owner = intersection.object.userData.materialId as number;
      const cells = this.simulation.cells(), walls = this.simulation.walls?.();
      const owns = (cx: number, cy: number): boolean => cx >= 0 && cy >= 0 && cx < this.simulation.width && cy < this.simulation.height
        && (walls?.[cy * this.simulation.width + cx] ? WALL_ID : cells[cy * this.simulation.width + cx]) === owner;
      if (!owns(x, y)) {
        let nearest = Infinity;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!owns(x + dx, y + dy)) continue;
          const distance = Math.hypot(x + dx + 0.5 - this.simulation.width / 2 - this.hit.x, this.simulation.height / 2 - y - dy - 0.5 - this.hit.y);
          if (distance < nearest) { nearest = distance; this.pointer.set(x + dx, y + dy); }
        }
        if (nearest < Infinity) { x = this.pointer.x; y = this.pointer.y; }
      }
    }
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return;
    return {x, y, z: this.hit.z};
  }

  /** Project an actual front/back surface sample for native-cell input checks. */
  projectCell(x: number, y: number, surface = true): {x: number; y: number; z: number} {
    const point = new THREE.Vector3(x + 0.5 - this.simulation.width / 2, this.simulation.height / 2 - y - 0.5, 0);
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld();
    if (surface) {
      const sign = this.camera.position.z >= 0 ? 1 : -1;
      const probe = new THREE.Raycaster(new THREE.Vector3(point.x, point.y, 200 * sign), new THREE.Vector3(0, 0, -sign));
      const hit = probe.intersectObjects(this.pickableMeshes(), false)[0];
      if (hit) point.z = hit.point.z;
    }
    const z = point.z, rect = this.canvas.getBoundingClientRect();
    point.project(this.camera);
    return {x: rect.left + (point.x + 1) / 2 * rect.width, y: rect.top + (1 - point.y) / 2 * rect.height, z};
  }

  showBrush(point: {x: number; y: number; z?: number} | undefined, radius: number): void {
    this.interactionUntil = performance.now() + 160;
    this.viewChanged = true; this.brush.visible = Boolean(point);
    if (point) { this.brush.position.set(point.x + 0.5 - this.simulation.width / 2, this.simulation.height / 2 - point.y - 0.5, (point.z ?? 0) + Math.sign(this.camera.position.z) * 0.5); this.brush.scale.setScalar(radius + 0.5); }
  }
  private resize(): void {
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    const previousFit = this.fitDistance();
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    const fit = this.fitDistance();
    this.camera.position.sub(this.controls.target).multiplyScalar(fit / previousFit).add(this.controls.target);
    this.controls.maxDistance = Math.max(1400, fit * 2.5);
    this.viewChanged = true;
    this.renderer.setSize(width, height, false);
    this.postprocess?.resize(width, height);
  }

  render(time: number, running: boolean): void {
    if (this.disposed) return;
    if (this.invalidated || (running && time - this.lastRefresh >= 80)) {
      this.rebuild(); this.lastRefresh = time; this.invalidated = false; this.viewChanged = true;
    }
    // Orbit easing should settle in the same wall time on slow and fast GPUs.
    const elapsed = Math.max(1, time - this.lastControlUpdate);
    this.lastControlUpdate = time;
    this.controls.dampingFactor = 1 - Math.exp(-Math.min(elapsed, 250) / 90);
    const cameraMoved = this.controls.update();
    const interactive = cameraMoved || time < this.interactionUntil;
    const refine = this.interactiveFrame && !interactive;
    if (!this.viewChanged && !cameraMoved && !refine) return;
    this.viewChanged = false;
    this.ground.position.x = this.camera.position.x; this.ground.position.z = this.camera.position.z;
    this.renderer.shadowMap.needsUpdate = this.shadowsDirty; this.shadowsDirty = false;
    this.renderer.info.reset();
    if (this.postprocess && !interactive) this.postprocess.render();
    else this.renderer.render(this.scene, this.camera);
    this.interactiveFrame = interactive;
    this.canvas.dataset.frameFinish = this.postprocess && !interactive ? 'cinematic' : 'interactive';
    this.stats.triangles = this.renderer.info.render.triangles;
    this.stats.drawCalls = this.renderer.info.render.calls;
  }

  private rebuild(): void {
    const started = performance.now();
    const cells = this.simulation.cells(), walls = this.simulation.walls?.();
    const {width, height} = this.simulation;
    const buckets = new Map<number, Bucket>();
    let occupied = 0, energyX = 0, energyY = 0, energyCount = 0;
    for (let index = 0; index < cells.length; index++) {
      const id = walls?.[index] ? WALL_ID : cells[index];
      if (!id) continue;
      occupied++;
      const x = index % width, y = Math.floor(index / width);
      let bucket = buckets.get(id);
      if (!bucket) { bucket = {indices: [], hash: 2166136261, minX: x, minY: y, maxX: x, maxY: y}; buckets.set(id, bucket); }
      bucket.indices.push(index); bucket.hash = Math.imul(bucket.hash ^ index, 16777619) >>> 0;
      bucket.minX = Math.min(bucket.minX, x); bucket.maxX = Math.max(bucket.maxX, x);
      bucket.minY = Math.min(bucket.minY, y); bucket.maxY = Math.max(bucket.maxY, y);
      if (infos.get(id)?.emissive) { energyX += x; energyY += y; energyCount++; }
    }
    for (const [id, body] of this.bodies) if (!buckets.has(id)) { this.shadowsDirty = true; this.removeBody(body); this.bodies.delete(id); }
    for (const [id, bucket] of buckets) {
      let body = this.bodies.get(id);
      if (!body) { body = {group: new THREE.Group(), hash: -1}; this.scene.add(body.group); this.bodies.set(id, body); }
      const info = infos.get(id), phase = info ? renderPhase(info) : RenderPhase.Solid;
      // Foreign matter entering an inter-grain pore must invalidate the merged
      // surface even when none of this powder's own particle cells changed.
      if (phase === RenderPhase.Powder) {
        for (let y = bucket.minY; y <= bucket.maxY; y++) for (let x = bucket.minX; x <= bucket.maxX; x++) {
          const index = y * width + x;
          if (walls?.[index] || (cells[index] && cells[index] !== id)) bucket.hash = Math.imul(bucket.hash ^ index, 16777619) >>> 0;
        }
      }
      if (body.hash === bucket.hash) continue;
      this.shadowsDirty = true;
      const material = this.material(id, phase);
      if (phase === RenderPhase.Gas || phase === RenderPhase.Energy) {
        if (body.mist) { body.mist.geometry.dispose(); body.group.remove(body.mist); }
        const positions = new Float32Array(bucket.indices.length * 3);
        bucket.indices.forEach((index, i) => { positions[i * 3] = index % width + 0.5 - width / 2; positions[i * 3 + 1] = height / 2 - Math.floor(index / width) - 0.5; positions[i * 3 + 2] = 4 + (index * 13 % 17) * 0.15; });
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        body.mist = new THREE.Points(geometry, material as THREE.PointsMaterial); body.group.add(body.mist);
      } else if (phase === RenderPhase.Powder) {
        this.updatePowder(body, bucket, id, material, cells, walls);
      } else {
        this.updateSurface(body, bucket, id, material, phase === RenderPhase.Liquid);
      }
      body.hash = bucket.hash;
    }
    this.sourceLight.intensity = energyCount ? Math.min(500, 80 + energyCount * 0.35) : 0;
    if (energyCount) this.sourceLight.position.set(energyX / energyCount - width / 2, height / 2 - energyY / energyCount, 28);
    this.stats.particles = occupied; this.stats.bodies = buckets.size;
    this.stats.densePowderCells = 0; this.stats.looseGrains = 0;
    for (const [id, body] of this.bodies) if (infos.get(id) && renderPhase(infos.get(id)!) === RenderPhase.Powder) {
      this.stats.densePowderCells += body.denseCells ?? 0;
      this.stats.looseGrains += body.instances?.count ?? 0;
    }
    this.stats.reconstructionMs = performance.now() - started;
  }

  private material(id: number, phase: RenderPhase): THREE.Material {
    const cached = this.materials.get(id); if (cached) return cached;
    const color = infos.get(id)?.color ?? '#738c9b';
    let material: THREE.Material;
    if (phase === RenderPhase.Gas || phase === RenderPhase.Energy) {
      const luminous = phase === RenderPhase.Energy || infos.get(id)?.emissive;
      material = new THREE.PointsMaterial({color: new THREE.Color(color).multiplyScalar(luminous ? 4 : 1), size: luminous ? 6 : 10, map: this.softTexture, transparent: true, opacity: luminous ? 0.24 : 0.065, depthWrite: false, blending: luminous ? THREE.AdditiveBlending : THREE.NormalBlending});
    } else if (phase === RenderPhase.Liquid || id === Material.Glass || id === Material.Ice) {
      const glass = id === Material.Glass;
      const water = id === Material.Water || id === Material.DistilledWater;
      material = new THREE.MeshPhysicalMaterial({color: glass ? '#f1fcff' : water ? '#b2e8ef' : color, metalness: METALS.has(id) ? 1 : 0, roughness: glass ? 0.075 : id === Material.Ice ? 0.22 : 0.14, transmission: METALS.has(id) ? 0 : glass ? 1 : 0.94, thickness: glass ? 84 : 72, ior: glass ? 1.5 : 1.333, attenuationColor: new THREE.Color(glass ? '#c6e8ef' : water ? '#289bb3' : color), attenuationDistance: glass ? 500 : 145, envMapIntensity: 1.15, clearcoat: glass ? 0 : 0.35, clearcoatRoughness: 0.16});
    } else if (METALS.has(id) || id === Material.Wood) {
      material = new THREE.MeshPhysicalMaterial({color: id === Material.Metal ? '#b9c5d0' : color, roughness: id === Material.Wood ? 0.62 : 0.24, metalness: METALS.has(id) ? 0.96 : 0, envMapIntensity: 1, clearcoat: id === Material.Wood ? 0.18 : 0.28, clearcoatRoughness: 0.3});
    } else {
      material = new THREE.MeshStandardMaterial({color, roughness: METALS.has(id) ? 0.3 : 0.85, metalness: METALS.has(id) ? 0.85 : 0.06, envMapIntensity: 0.7});
    }
    if (material instanceof THREE.MeshStandardMaterial && infos.get(id)?.emissive) { material.emissive.set(color); material.emissiveIntensity = 1.2; }
    if (material instanceof THREE.MeshStandardMaterial && phase === RenderPhase.Powder) {
      material.roughness = 0.94; material.metalness = METALS.has(id) ? 0.75 : 0; material.map = this.textures.grain; material.bumpMap = this.textures.grain; material.bumpScale = 0.22;
    }
    if (material instanceof THREE.MeshStandardMaterial && id === Material.Wood) {
      material.color.set('#b27542'); material.map = material.bumpMap = this.textures.wood;
      material.bumpScale = 0.16; material.roughness = 0.62;
    }
    if (material instanceof THREE.MeshPhysicalMaterial && phase === RenderPhase.Liquid) {
      material.normalMap = this.textures.waterNormal; material.normalScale.set(0.035, 0.035);
    }
    this.materials.set(id, material); return material;
  }

  private updateInstances(body: Body, indices: readonly number[], material: THREE.Material, liquid: boolean, voxel = false): void {
    if (!indices.length) { if (body.instances) body.instances.count = 0; return; }
    const geometry = voxel ? this.voxel : liquid ? this.drop : this.grain;
    if (!body.instances || body.instances.geometry !== geometry || body.instances.instanceMatrix.count < indices.length) {
      if (body.instances) { body.group.remove(body.instances); body.instances.dispose(); }
      body.instances = new THREE.InstancedMesh(geometry, material, Math.min(this.simulation.width * this.simulation.height, 2 ** Math.ceil(Math.log2(indices.length))));
      body.instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      body.instances.castShadow = !liquid; body.instances.receiveShadow = true;
      body.group.add(body.instances);
    }
    body.instances.count = indices.length;
    body.instances.userData.cells = indices;
    indices.forEach((index, i) => {
      this.matrix.makeTranslation(index % this.simulation.width + 0.5 - this.simulation.width / 2, this.simulation.height / 2 - Math.floor(index / this.simulation.width) - 0.5, ((index * 7) % 11) * 0.13);
      body.instances!.setMatrixAt(i, this.matrix);
    });
    body.instances.instanceMatrix.needsUpdate = true; body.instances.computeBoundingSphere();
  }

  private updatePowder(body: Body, bucket: Bucket, id: number, material: THREE.Material, cells: Uint8Array, walls?: Uint8Array): void {
    const width = bucket.maxX - bucket.minX + 1, height = bucket.maxY - bucket.minY + 1;
    const local = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (bucket.minY + y) * this.simulation.width + bucket.minX + x;
      local[y * width + x] = walls?.[index] ? 2 : cells[index] === id ? 1 : cells[index] ? 2 : 0;
    }
    const support = powderSupport(local, width, height);
    body.denseCells = support.denseCount;
    this.updateInstances(body, support.loose.map(index => (Math.floor(index / width) + bucket.minY) * this.simulation.width + index % width + bucket.minX), material, false);
    if (body.surface) { body.surface.geometry.dispose(); body.group.remove(body.surface); body.surface = undefined; }
    if (support.denseCount) {
      const geometry = powderVolumeGeometry(support.dense, width, height, bucket.minX - this.simulation.width / 2, this.simulation.height / 2 - bucket.minY);
      geometry.computeBoundingBox();
      body.surface = new THREE.Mesh(geometry, material);
      body.surface.userData.materialId = id;
      body.surface.castShadow = body.surface.receiveShadow = true; body.group.add(body.surface);
    }
  }

  private updateSurface(body: Body, bucket: Bucket, id: number, material: THREE.Material, liquid: boolean): void {
    if (body.surface) { body.surface.geometry.dispose(); body.group.remove(body.surface); body.surface = undefined; }
    const w = bucket.maxX - bucket.minX + 1, h = bucket.maxY - bucket.minY + 1;
    const local = new Uint8Array(w * h);
    for (const index of bucket.indices) local[(Math.floor(index / this.simulation.width) - bucket.minY) * w + index % this.simulation.width - bucket.minX] = 1;
    const loops = materialContours(local, w, h, 1);
    // Highly fragmented worlds must not allocate millions of bevel vertices or
    // run a quadratic hole-to-island search. Keep all cells visible as instances.
    if (loops.length > 1024 || loops.reduce((sum, loop) => sum + loop.points.length, 0) > 20000) {
      this.updateInstances(body, bucket.indices, material, liquid, !liquid);
      return;
    }
    const outer = loops.filter(loop => loop.area > 0);
    const holes = loops.filter(loop => loop.area < 0);
    const shapes: THREE.Shape[] = [];
    const droplets: number[] = [];
    const convert = (p: {x: number; y: number}): THREE.Vector2 => new THREE.Vector2(p.x + bucket.minX - this.simulation.width / 2, this.simulation.height / 2 - p.y - bucket.minY);
    for (const loop of outer) {
      if (liquid && loop.area <= 1) {
        for (const p of loop.points.slice(0, 1)) droplets.push((bucket.minY + Math.floor(p.y)) * this.simulation.width + bucket.minX + Math.floor(p.x));
        continue;
      }
      const shape = new THREE.Shape(loop.points.map(convert));
      for (const hole of holes) {
        const probe = hole.points[0];
        // Choose the smallest containing outer contour, so nested islands stay independent.
        if (contourContains(loop.points, probe) && !outer.some(other => other !== loop && other.area < loop.area && contourContains(other.points, probe))) {
          shape.holes.push(new THREE.Path(hole.points.map(convert)));
        }
      }
      shapes.push(shape);
    }
    this.updateInstances(body, droplets, material, true);
    if (!shapes.length) return;
    const depth = id === WALL_ID ? 96 : liquid ? 72 : 84;
    const geometry = new THREE.ExtrudeGeometry(shapes, {depth, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: liquid ? 0.38 : 0.35, bevelThickness: liquid ? 3 : 2, curveSegments: 1});
    geometry.translate(0, 0, -depth / 2); geometry.computeBoundingBox();
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 64, uv.getY(i) / 64);
    body.surface = new THREE.Mesh(geometry, material); body.surface.userData.materialId = id; body.surface.castShadow = !liquid && id !== Material.Glass; body.surface.receiveShadow = true; body.group.add(body.surface);
  }

  private removeBody(body: Body): void {
    body.surface?.geometry.dispose(); body.mist?.geometry.dispose(); body.instances?.dispose(); this.scene.remove(body.group);
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.resizeObserver.disconnect(); this.controls.dispose();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost); this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    for (const body of this.bodies.values()) this.removeBody(body);
    this.bodies.clear();
    const stageMaterials = new Set<THREE.Material>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) stageMaterials.add(material); } });
    for (const material of this.materials.values()) material.dispose();
    for (const material of stageMaterials) material.dispose();
    this.grain.dispose(); this.drop.dispose(); this.voxel.dispose(); this.environment.dispose(); this.softTexture.dispose();
    for (const texture of Object.values(this.textures)) texture.dispose();
    this.postprocess?.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.canvas.remove();
  }
}
