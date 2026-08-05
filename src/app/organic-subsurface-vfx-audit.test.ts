import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { createRenderLookups } from '../renderer/render-field-set';
import { writeSolidOpticalDepth } from '../renderer/solid-optical-depth-field';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  ORGANIC_SUBSURFACE_VFX_AUDIT,
  ORGANIC_SUBSURFACE_VFX_ACTIVE_DRY_PLNT_STATE,
  ORGANIC_SUBSURFACE_VFX_DORMANT_PLNT_STATE,
  ORGANIC_SUBSURFACE_VFX_DRY_SEED_STATE,
  ORGANIC_SUBSURFACE_VFX_HYDRATED_NON_TREE_PLNT_STATE,
  ORGANIC_SUBSURFACE_VFX_HYDRATED_NO_PRESENT_PLNT_STATE,
  ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE,
  ORGANIC_SUBSURFACE_VFX_HYDRATED_SEED_STATE,
  ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT,
  ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH,
  prepareOrganicSubsurfaceVfxFixture,
  type OrganicSubsurfaceVfxPoint,
  type OrganicSubsurfaceVfxRect,
} from './organic-subsurface-vfx-audit';

const world: OrganicSubsurfaceVfxRect = {
  x: 0, y: 0, width: ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH, height: ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT,
};

describe('organic subsurface VFX audit fixture', () => {
  it('pins broad exact WAX and hydrated native-tree PLNT bodies with protected depth bands', () => {
    expect(ORGANIC_SUBSURFACE_VFX_AUDIT.panes.map(({ code, material, presentationState }) => (
      [code, material, presentationState]
    ))).toEqual([
      ['WAX', Material.Wax, 0],
      ['PLNT', Material.Plant, ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE],
    ]);
    for (const pane of ORGANIC_SUBSURFACE_VFX_AUDIT.panes) {
      for (const rect of [pane.body, pane.authoredHole, pane.openNotch, pane.attachedLine,
        pane.firstInnerLayer, pane.edgeBand, pane.depthBand, pane.deepCore]) {
        expect(rectInside(rect, world)).toBe(true);
      }
      expect(pointInside(pane.isolated, world)).toBe(true);
      expect(pointInside(pane.fadeTip, world)).toBe(true);
      expect(pane.firstInnerLayer.x - pane.body.x).toBe(1);
      expect(pane.edgeBand.x - pane.body.x).toBe(2);
      expect(pane.depthBand.x - pane.body.x).toBe(6);
      expect(pane.deepCore.x - pane.body.x).toBeGreaterThanOrEqual(96);
      expect(pane.attachedLine.y).toBe(pane.body.y + pane.body.height);
    }
    const controls = ORGANIC_SUBSURFACE_VFX_AUDIT.controls;
    expect(controls.hydratedSeed.presentationState).toBe(ORGANIC_SUBSURFACE_VFX_HYDRATED_SEED_STATE);
    expect(controls.drySeed.presentationState).toBe(ORGANIC_SUBSURFACE_VFX_DRY_SEED_STATE);
    expect(controls.dormantPlant.presentationState).toBe(ORGANIC_SUBSURFACE_VFX_DORMANT_PLNT_STATE);
    expect(controls.activeDryPlant.presentationState).toBe(ORGANIC_SUBSURFACE_VFX_ACTIVE_DRY_PLNT_STATE);
    expect(controls.hydratedNonTreePlant.presentationState).toBe(ORGANIC_SUBSURFACE_VFX_HYDRATED_NON_TREE_PLNT_STATE);
    expect(controls.hydratedNonTreePlant.material).toBe(Material.Plant);
    expect(controls.hydratedNoPresentPlant.presentationState).toBe(
      ORGANIC_SUBSURFACE_VFX_HYDRATED_NO_PRESENT_PLNT_STATE,
    );
    expect(controls.emissiveLava.material).toBe(Material.Lava);
    expect(controls.zeroStatePlant.presentationState).toBe(0);
  });

  it('stages exact matter, native state, walls, seams, holes, and blank controls', () => {
    const simulation = fixture();
    const cells = simulation.cells();
    const states = simulation.presentationState();
    const walls = simulation.walls();
    for (const pane of ORGANIC_SUBSURFACE_VFX_AUDIT.panes) {
      expectStateRectExcept(cells, states, pane.body, pane.material, pane.presentationState,
        [pane.authoredHole, pane.openNotch]);
      expectStateRect(cells, states, pane.authoredHole, Material.Empty, 0);
      expectStateRect(cells, states, pane.openNotch, Material.Empty, 0);
      expectStateRect(cells, states, pane.attachedLine, pane.material, pane.presentationState);
      expect(materialAt(cells, pane.isolated)).toBe(pane.material);
      expect(stateAt(states, pane.isolated)).toBe(pane.presentationState);
    }

    const { controls, directUnlikeSeams, conductiveWall } = ORGANIC_SUBSURFACE_VFX_AUDIT;
    for (const control of [controls.moltenWax, controls.hydratedSeed, controls.drySeed,
      controls.dormantPlant, controls.activeDryPlant, controls.hydratedNonTreePlant,
      controls.hydratedNoPresentPlant, controls.zeroStatePlant,
      controls.wrongOwner, controls.emitterTrait, controls.emissiveLava]) {
      expectStateRect(cells, states, control.body, control.material, control.presentationState);
    }
    expectStateRect(cells, states, controls.guardedBlank, Material.Empty, 0);
    for (const seam of directUnlikeSeams) {
      expectStateRect(cells, states, seam.left.body, seam.left.material, seam.left.presentationState);
      expectStateRect(cells, states, seam.right.body, seam.right.material, seam.right.presentationState);
    }
    for (const control of [controls.waxWall, controls.plantWall]) {
      expectStateRect(cells, states, control.body, control.material, control.presentationState);
      forEachPoint(control.body, (point) => expect(wallAt(walls, point)).toBe(conductiveWall));
      expect(wallAt(walls, control.probe)).toBe(conductiveWall);
    }
  });

  it('pins the depth field from its first layer through the protected core and rejects topology controls', () => {
    const simulation = fixture();
    const depth = new Uint8Array(ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH * ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT);
    writeSolidOpticalDepth(
      simulation.cells(), depth, createRenderLookups(ALL_MATERIALS).styleBytes,
      ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH, simulation.walls(),
    );
    for (const pane of ORGANIC_SUBSURFACE_VFX_AUDIT.panes) {
      const row = pane.edgeBand.y + Math.floor(pane.edgeBand.height / 2);
      expect(depthAt(depth, { x: pane.firstInnerLayer.x, y: row })).toBe(6);
      expect(depthBand(depth, pane.edgeBand, row)).toEqual([12, 18, 24, 30]);
      expect(depthBand(depth, pane.depthBand, row)).toEqual([36, 42, 48, 54, 60, 66]);
      expect(depthAt(depth, pane.fadeTip)).toBe(66);
      expect(depthAt(depth, pane.deepCore)).toBeGreaterThanOrEqual(72);
      expect(depthAt(depth, { x: pane.attachedLine.x, y: pane.attachedLine.y })).toBe(0);
      expect(depthAt(depth, pane.isolated)).toBe(0);
      expect(depthAt(depth, pane.authoredHole)).toBe(0);
      expect(depthAt(depth, pane.openNotch)).toBe(0);
    }
    const { controls, directUnlikeSeams } = ORGANIC_SUBSURFACE_VFX_AUDIT;
    for (const control of [controls.moltenWax, controls.hydratedSeed, controls.drySeed,
      controls.emissiveLava, controls.waxWall, controls.plantWall]) {
      expect(depthAt(depth, control.probe)).toBe(0);
    }
    // These are all broad exact PLNT solids with a qualifying body depth; only
    // their packed native state may distinguish E11 positives from controls.
    for (const control of [controls.dormantPlant, controls.activeDryPlant,
      controls.hydratedNonTreePlant, controls.hydratedNoPresentPlant,
      controls.zeroStatePlant]) {
      expect(depthAt(depth, control.probe)).toBeGreaterThan(6);
    }
    expect(depthAt(depth, controls.hydratedNonTreePlant.probe)).toBe(24);
    for (const seam of directUnlikeSeams) expect(depthAt(depth, seam.leftBoundaryProbe)).toBe(0);
  });

  it('is deterministic, clears stale native state and walls, stays in bounds, and rejects unsupported backends', () => {
    const first = fixture();
    const second = fixture();
    expect(byteHash(first.cells())).toBe(byteHash(second.cells()));
    expect(byteHash(first.presentationState())).toBe(byteHash(second.presentationState()));
    expect(byteHash(first.walls())).toBe(byteHash(second.walls()));

    const expectedCells = first.cells().slice();
    const expectedStates = first.presentationState().slice();
    const expectedWalls = first.walls().slice();
    first.cells().fill(Material.Fire);
    first.setFixturePresentationStateRect(0, 0, ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH, ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT, 0xFFFF);
    first.paintWall(4, 4, ORGANIC_SUBSURFACE_VFX_AUDIT.conductiveWall, 0);
    prepareOrganicSubsurfaceVfxFixture(first);
    expect(byteHash(first.cells())).toBe(byteHash(expectedCells));
    expect(byteHash(first.presentationState())).toBe(byteHash(expectedStates));
    expect(byteHash(first.walls())).toBe(byteHash(expectedWalls));

    for (const pane of ORGANIC_SUBSURFACE_VFX_AUDIT.panes) {
      for (const rect of [pane.body, pane.authoredHole, pane.openNotch, pane.attachedLine,
        pane.firstInnerLayer, pane.edgeBand, pane.depthBand, pane.deepCore]) expect(rectInside(rect, world)).toBe(true);
    }
    const { controls, directUnlikeSeams } = ORGANIC_SUBSURFACE_VFX_AUDIT;
    for (const control of [controls.moltenWax, controls.hydratedSeed, controls.drySeed,
      controls.dormantPlant, controls.activeDryPlant, controls.hydratedNonTreePlant,
      controls.hydratedNoPresentPlant, controls.zeroStatePlant,
      controls.wrongOwner, controls.emitterTrait, controls.emissiveLava,
      controls.waxWall, controls.plantWall]) expect(rectInside(control.body, world)).toBe(true);
    expect(rectInside(controls.guardedBlank, world)).toBe(true);
    for (const seam of directUnlikeSeams) {
      expect(rectInside(seam.left.body, world)).toBe(true);
      expect(rectInside(seam.right.body, world)).toBe(true);
    }
    expect(() => prepareOrganicSubsurfaceVfxFixture(new RenderLabBackend(32, 32))).toThrow('requires 612x384');
    expect(() => prepareOrganicSubsurfaceVfxFixture(new DeterministicBackend(
      ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH, ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT,
    ))).toThrow('requires render-lab wall and state planes');
  });
});

function fixture(): RenderLabBackend {
  const simulation = new RenderLabBackend(ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH, ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT);
  prepareOrganicSubsurfaceVfxFixture(simulation);
  return simulation;
}

function materialAt(cells: Uint8Array, point: OrganicSubsurfaceVfxPoint): Material {
  return cells[point.y * ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH + point.x] as Material;
}

function stateAt(states: Uint16Array, point: OrganicSubsurfaceVfxPoint): number {
  return states[point.y * ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH + point.x];
}

function wallAt(walls: Uint8Array, point: OrganicSubsurfaceVfxPoint): number {
  return walls[point.y * ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH + point.x];
}

function depthAt(depth: Uint8Array, point: OrganicSubsurfaceVfxPoint): number {
  return depth[point.y * ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH + point.x];
}

function depthBand(depth: Uint8Array, rect: OrganicSubsurfaceVfxRect, row: number): number[] {
  return Array.from({ length: rect.width }, (_, offset) => depthAt(depth, { x: rect.x + offset, y: row }));
}

function expectStateRect(
  cells: Uint8Array, states: Uint16Array, rect: OrganicSubsurfaceVfxRect, material: Material, state: number,
): void {
  forEachPoint(rect, (point) => {
    expect(materialAt(cells, point)).toBe(material);
    expect(stateAt(states, point)).toBe(state);
  });
}

function expectStateRectExcept(
  cells: Uint8Array,
  states: Uint16Array,
  rect: OrganicSubsurfaceVfxRect,
  material: Material,
  state: number,
  exceptions: readonly OrganicSubsurfaceVfxRect[],
): void {
  forEachPoint(rect, (point) => {
    if (exceptions.some((exception) => contains(exception, point))) return;
    expect(materialAt(cells, point)).toBe(material);
    expect(stateAt(states, point)).toBe(state);
  });
}

function rectInside(inner: OrganicSubsurfaceVfxRect, outer: OrganicSubsurfaceVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function pointInside(point: OrganicSubsurfaceVfxPoint, outer: OrganicSubsurfaceVfxRect): boolean {
  return point.x >= outer.x && point.y >= outer.y
    && point.x < outer.x + outer.width && point.y < outer.y + outer.height;
}

function contains(rect: OrganicSubsurfaceVfxRect, point: OrganicSubsurfaceVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}

function forEachPoint(rect: OrganicSubsurfaceVfxRect, visit: (point: OrganicSubsurfaceVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function byteHash(values: Uint8Array | Uint16Array): number {
  let hash = 2166136261;
  for (const value of values) hash = Math.imul(hash ^ value, 16777619) >>> 0;
  return hash;
}
