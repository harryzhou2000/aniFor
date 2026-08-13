/**
 * Data-only representative board for the phase/class appearance-profile seam.
 * The catalog has no renderer, browser, fixture, or capture authority: a typed
 * app-side preparer validates these records before it fills a paused world.
 */

export const RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.render-optics-material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const rect = (x, y, width, height) => ({ x, y, width, height });
const point = (x, y) => ({ x, y });

const GRID = Object.freeze({ columns: 5, rows: 4, origin: point(6, 6), stride: point(120, 94) });
const CARD_SIZE = Object.freeze({ width: 112, height: 88 });

const definitions = [
  ['sand', 'powder', 7, 1], ['salt', 'powder', 13, 7],
  ['gunpowder', 'powder', 14, 14], ['thermite', 'powder', 15, 30],
  ['ceramic', 'solid', 8, 25],
  ['water', 'liquid', 1, 2], ['oil', 'liquid', 2, 8],
  ['acid', 'liquid', 3, 13], ['lava', 'liquid', 4, 11],
  ['liquid-nitrogen', 'liquid', 16, 37],
  ['mercury', 'liquid', 17, 36], ['mwax', 'liquid', 18, 59],
  ['smoke', 'gas', 5, 5], ['oxygen', 'gas', 6, 39],
  ['wood', 'solid', 9, 9],
  ['btry', 'solid', 10, 136], ['iszs', 'solid', 11, 105],
  ['glass', 'solid', 12, 24], ['metal', 'solid', 20, 23], ['wax', 'solid', 21, 27],
];

const phaseFineControl = (phase, card) => {
  if (phase === 'powder') return rect(card.x + 96, card.y + 15, 1, 46);
  if (phase === 'liquid') return rect(card.x + 62, card.y + 68, 22, 2);
  if (phase === 'gas') return rect(card.x + 96, card.y + 31, 3, 1);
  return rect(card.x + 96, card.y + 28, 1, 22);
};

const cards = definitions.map(([key, phase, optics, material], index) => {
  const column = index % GRID.columns;
  const row = Math.floor(index / GRID.columns);
  const card = rect(
    GRID.origin.x + column * GRID.stride.x,
    GRID.origin.y + row * GRID.stride.y,
    CARD_SIZE.width,
    CARD_SIZE.height,
  );
  const body = rect(card.x + 14, card.y + 14, 84, 48);
  return {
    key, phase, optics, material, card, body,
    core: rect(card.x + 38, card.y + 38, 20, 14),
    cavity: rect(card.x + 51, card.y + 30, 8, 8),
    openNotch: rect(card.x + 52, card.y + 14, 4, 16),
    isolated: point(card.x + 101, card.y + 70),
    fineControl: phaseFineControl(phase, card),
    emitter: rect(card.x + 8, card.y + 28, 5, 24),
  };
});

const byKey = Object.fromEntries(cards.map((card) => [card.key, card]));
const contact = (name, owner, neighbour, ownerMaterial, neighbourMaterial) => ({
  name, owner, neighbour, ownerMaterial, neighbourMaterial,
});

// These compact contact strips occupy the lower unused band of the named card.
// The named members are explicit materials rather than inferred from card order.
const contacts = [
  contact(
    'wax-mwax-contact', rect(byKey.wax.card.x + 16, byKey.wax.card.y + 68, 16, 12),
    rect(byKey.wax.card.x + 32, byKey.wax.card.y + 68, 16, 12), 27, 59,
  ),
  contact(
    'glass-metal-contact', rect(byKey.glass.card.x + 16, byKey.glass.card.y + 68, 16, 12),
    rect(byKey.glass.card.x + 32, byKey.glass.card.y + 68, 16, 12), 24, 23,
  ),
];

const nativeWall = {
  body: rect(byKey.metal.card.x + 98, byKey.metal.card.y + 24, 8, 30),
  anchor: point(byKey.metal.card.x + 100, byKey.metal.card.y + 28),
};
const guardedBlank = rect(6, 376, 592, 8);

const inspectionRegions = [
  ...cards.flatMap(({ key, body, core }) => [
    { name: `${key}-body`, role: 'response', ...body },
    { name: `${key}-core`, role: 'response', ...core },
  ]),
  { name: 'powder-fine-control', role: 'control', ...byKey.sand.fineControl },
  { name: 'liquid-fine-control', role: 'control', ...byKey.water.fineControl },
  { name: 'gas-fine-control', role: 'control', ...byKey.smoke.fineControl },
  { name: 'solid-fine-control', role: 'control', ...byKey.ceramic.fineControl },
  {
    name: 'wax-mwax-contact', role: 'control',
    x: contacts[0].owner.x, y: contacts[0].owner.y,
    width: contacts[0].owner.width + contacts[0].neighbour.width,
    height: contacts[0].owner.height,
  },
  {
    name: 'glass-metal-contact', role: 'control',
    x: contacts[1].owner.x, y: contacts[1].owner.y,
    width: contacts[1].owner.width + contacts[1].neighbour.width,
    height: contacts[1].owner.height,
  },
  { name: 'native-wall', role: 'control', ...nativeWall.body },
  { name: 'guarded-blank', role: 'control', ...guardedBlank },
  { name: 'solid-cavity-control', role: 'control', ...byKey.ceramic.cavity },
];

export const RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: RENDER_OPTICS_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'render-optics-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      grid: GRID,
      cardSize: CARD_SIZE,
      materials: { empty: 0, fire: 4 },
      conductiveWall: 1,
      cards,
      contacts,
      nativeWall,
      guardedBlank,
      inspectionRegions,
    },
  }],
});
