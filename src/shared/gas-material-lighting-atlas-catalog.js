/**
 * Data-only authoring for the paused gas material-lighting board. The app
 * projects this descriptor into simulation state and Node tooling projects the
 * same geometry into current-only inspection regions. It grants no renderer,
 * capture, or browser execution authority.
 */

export const GAS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.gas-material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

export const GAS_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: GAS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'gas-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      materials: {
        empty: 0,
        sooty: 5,
        clean: 39,
        warmEmitter: 4,
        coolEmitter: 103,
        solidContactOwner: 23,
        liquidContactOwner: 2,
        foreignGas: 42,
        foreignGasNeighbour: 65,
        emissiveGas: 87,
      },
      conductiveWall: 1,
      sooty: {
        bounds: { x: 24, y: 28, width: 258, height: 196 },
        probe: { x: 188, y: 126 },
        lobes: [
          { x: 148, y: 126, radiusX: 94, radiusY: 62 },
          { x: 78, y: 98, radiusX: 45, radiusY: 37 },
          { x: 211, y: 158, radiusX: 57, radiusY: 41 },
          { x: 174, y: 62, radiusX: 42, radiusY: 28 },
        ],
      },
      clean: {
        bounds: { x: 326, y: 28, width: 258, height: 196 },
        probe: { x: 454, y: 120 },
        lobes: [
          { x: 454, y: 120, radiusX: 96, radiusY: 58 },
          { x: 384, y: 150, radiusX: 47, radiusY: 36 },
          { x: 522, y: 82, radiusX: 49, radiusY: 34 },
          { x: 474, y: 176, radiusX: 39, radiusY: 28 },
        ],
      },
      sootyHole: { x: 136, y: 114, width: 20, height: 18 },
      cleanChannel: { x: 326, y: 44, width: 14, height: 54 },
      warmEmitter: { x: 16, y: 88, width: 5, height: 76 },
      coolEmitter: { x: 590, y: 84, width: 5, height: 74 },
      sparseSooty: [
        { x: 34, y: 352 }, { x: 36, y: 352 }, { x: 68, y: 352 }, { x: 102, y: 352 },
      ],
      sparseClean: [
        { x: 376, y: 352 }, { x: 378, y: 352 }, { x: 412, y: 352 }, { x: 450, y: 352 },
      ],
      solidContact: {
        gas: { x: 24, y: 252, width: 62, height: 42 },
        solid: { x: 86, y: 252, width: 28, height: 42 },
        probe: { x: 84, y: 272 },
      },
      liquidContact: {
        gas: { x: 144, y: 252, width: 62, height: 42 },
        liquid: { x: 206, y: 252, width: 28, height: 42 },
        probe: { x: 204, y: 272 },
      },
      foreignGasContact: {
        gas: { x: 264, y: 252, width: 62, height: 42 },
        foreignGas: { x: 326, y: 252, width: 28, height: 42 },
        gasProbe: { x: 324, y: 272 },
        foreignProbe: { x: 327, y: 272 },
      },
      nativeWall: {
        gas: { x: 384, y: 252, width: 72, height: 42 },
        anchor: { x: 420, y: 272 },
      },
      emissiveGas: {
        body: { x: 484, y: 252, width: 48, height: 42 },
        probe: { x: 508, y: 272 },
      },
      guardedBlank: { x: 138, y: 314, width: 364, height: 22 },
    },
  }],
});
