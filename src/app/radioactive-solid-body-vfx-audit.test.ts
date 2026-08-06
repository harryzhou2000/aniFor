import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  RADIOACTIVE_SOLID_BODY_VFX_AUDIT,
  prepareRadioactiveSolidBodyVfxFixture,
  type RadioactiveSolidBodyVfxPoint,
  type RadioactiveSolidBodyVfxRect,
} from './radioactive-solid-body-vfx-audit';
import { decodeVibrPresentationState, VIBR_STATE_GRAPHICS_STATES } from './vibr-state-graphics-audit';

describe('radioactive solid-body VFX audit fixture', () => {
  it('pins broad exact ISZS and VIBR bodies with separate core, crown, and pocket probes', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(RADIOACTIVE_SOLID_BODY_VFX_AUDIT.targets.map(({ code, material }) => ({ code, material }))).toEqual([
      { code: 'ISZS', material: Material.ISZS },
      { code: 'VIBR', material: Material.VIBR },
    ]);
    for (const target of RADIOACTIVE_SOLID_BODY_VFX_AUDIT.targets) {
      for (const probe of [target.core, target.crown, target.pocket]) {
        expect(at(cells, simulation.width, centre(probe))).toBe(target.material);
      }
      expectRect(cells, simulation.width, target.authoredHole, Material.Empty);
      expectRect(cells, simulation.width, target.openNotch, Material.Empty);
      expect(target.openNotch.x + target.openNotch.width).toBe(target.body.x + target.body.width);
      expectRect(simulation.presentationState(), simulation.width, target.body, 0, [target.authoredHole, target.openNotch]);
    }
  });

  it('preserves fine structures, walls, seams, contacts, and radioactive sibling ownership', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const walls = simulation.walls();
    for (const target of RADIOACTIVE_SOLID_BODY_VFX_AUDIT.targets) {
      expectRect(cells, simulation.width, target.thinLine, target.material);
      expect(at(cells, simulation.width, target.isolated)).toBe(target.material);
      expectRect(cells, simulation.width, target.wallCoexistence, target.material);
      expectRect(walls, simulation.width, target.wallCoexistence, RADIOACTIVE_SOLID_BODY_VFX_AUDIT.conductiveWall);
      expectRect(cells, simulation.width, target.guardedBlank, Material.Empty);
    }
    const seam = RADIOACTIVE_SOLID_BODY_VFX_AUDIT.iszsVibrSeam;
    expect(at(cells, simulation.width, seam.iszsProbe)).toBe(Material.ISZS);
    expect(at(cells, simulation.width, seam.vibrProbe)).toBe(Material.VIBR);
    expect(seam.iszs.x + seam.iszs.width).toBe(seam.vibr.x);
    for (const contact of RADIOACTIVE_SOLID_BODY_VFX_AUDIT.contacts) {
      expect(at(cells, simulation.width, contact.targetProbe)).toBe(contact.targetMaterial);
      expect(at(cells, simulation.width, contact.foreignProbe)).toBe(contact.foreignMaterial);
      expect(contact.target.x + contact.target.width).toBe(contact.foreign.x);
    }
    for (const control of RADIOACTIVE_SOLID_BODY_VFX_AUDIT.protectedControls) {
      expect(at(cells, simulation.width, control.probe)).toBe(control.material);
    }
  });

  it('uses the existing exact VIBR packing for every VIBR and BVBR state control', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const state = simulation.presentationState();
    expect(RADIOACTIVE_SOLID_BODY_VFX_AUDIT.vibrStateCards).toHaveLength(5);
    expect(RADIOACTIVE_SOLID_BODY_VFX_AUDIT.bvbrStateCards).toHaveLength(5);
    for (const card of RADIOACTIVE_SOLID_BODY_VFX_AUDIT.stateCards) {
      expect(at(cells, simulation.width, card.probe)).toBe(card.material);
      expect(at(state, simulation.width, card.probe)).toBe(card.encodedState);
      expect(decodeVibrPresentationState(card.encodedState)).toEqual({
        charge: card.charge, life: card.life, alternate: card.alternate,
      });
    }
    expect(RADIOACTIVE_SOLID_BODY_VFX_AUDIT.vibrStateCards.map(({ stateKey }) => stateKey))
      .toEqual(VIBR_STATE_GRAPHICS_STATES.map(({ key }) => key));
    expect(RADIOACTIVE_SOLID_BODY_VFX_AUDIT.bvbrStateCards.map(({ stateKey }) => stateKey))
      .toEqual(VIBR_STATE_GRAPHICS_STATES.map(({ key }) => key));
  });

  it('keeps every declared region inside the canonical world without card overlap', () => {
    const world = { x: 0, y: 0, width: 612, height: 384 };
    const regions: RadioactiveSolidBodyVfxRect[] = [
      ...RADIOACTIVE_SOLID_BODY_VFX_AUDIT.targets.flatMap((target) => [
        target.card, target.body, target.core, target.crown, target.pocket, target.authoredHole,
        target.openNotch, target.thinLine, target.wallCoexistence, target.guardedBlank,
      ]),
      RADIOACTIVE_SOLID_BODY_VFX_AUDIT.iszsVibrSeam.iszs,
      RADIOACTIVE_SOLID_BODY_VFX_AUDIT.iszsVibrSeam.vibr,
      ...RADIOACTIVE_SOLID_BODY_VFX_AUDIT.contacts.flatMap(({ target, foreign }) => [target, foreign]),
      ...RADIOACTIVE_SOLID_BODY_VFX_AUDIT.protectedControls.map(({ region }) => region),
      ...RADIOACTIVE_SOLID_BODY_VFX_AUDIT.stateCards.flatMap(({ card, body }) => [card, body]),
    ];
    for (const region of regions) expect(inside(region, world)).toBe(true);
    const cards = [
      ...RADIOACTIVE_SOLID_BODY_VFX_AUDIT.targets.map(({ card }) => card),
      ...RADIOACTIVE_SOLID_BODY_VFX_AUDIT.stateCards.map(({ card }) => card),
    ];
    for (let left = 0; left < cards.length; left++) {
      for (let right = left + 1; right < cards.length; right++) {
        expect(overlaps(cards[left], cards[right])).toBe(false);
      }
    }
  });

  it('resets material, native wall, and presentation-state planes deterministically', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    const state = simulation.presentationState().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    simulation.setFixturePresentationStateRect(2, 2, 1, 1, 0xFFFF);
    prepareRadioactiveSolidBodyVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);
    expect(simulation.presentationState()).toEqual(state);

    expect(() => prepareRadioactiveSolidBodyVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall and state planes');
    expect(() => prepareRadioactiveSolidBodyVfxFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareRadioactiveSolidBodyVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array | Uint16Array, width: number, point: RadioactiveSolidBodyVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: RadioactiveSolidBodyVfxRect): RadioactiveSolidBodyVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(
  bytes: Uint8Array | Uint16Array,
  width: number,
  rect: RadioactiveSolidBodyVfxRect,
  expected: number,
  excluded: readonly RadioactiveSolidBodyVfxRect[] = [],
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (excluded.some((entry) => x >= entry.x && x < entry.x + entry.width && y >= entry.y && y < entry.y + entry.height)) continue;
      expect(bytes[y * width + x]).toBe(expected);
    }
  }
}

function inside(inner: RadioactiveSolidBodyVfxRect, outer: RadioactiveSolidBodyVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function overlaps(left: RadioactiveSolidBodyVfxRect, right: RadioactiveSolidBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
