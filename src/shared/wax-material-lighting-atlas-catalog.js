/**
 * Data-only authoring catalog for the paired WAX/MWAX material-lighting board.
 * App fixture preparation and current-only inspection both project this frozen
 * geometry. It grants neither browser nor renderer execution authority.
 */

export const WAX_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA = (
  'anifor.visual-lab.wax-material-lighting-atlas-catalog/v1'
);

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const rectPoints = (rect) => {
  const points = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
};

const buildSolidStructure = (card, body) => [
  ...rectPoints({ x: body.x + 79, y: body.y + body.height, width: 2, height: 28 }),
  ...rectPoints({ x: card.x + 28, y: 184, width: 120, height: 1 }),
  ...rectPoints({ x: card.x + 40, y: 190, width: 96, height: 1 }),
  ...rectPoints({ x: card.x + 54, y: 196, width: 68, height: 1 }),
];

const buildLiquidStructure = (card, body) => {
  const points = rectPoints({
    x: body.x + 79, y: body.y + body.height, width: 2, height: 30,
  });
  for (let step = 0; step < 32; step++) {
    const x = body.x + 81 + step;
    const y = body.y + body.height + 29 + Math.floor(step / 4);
    points.push({ x, y }, { x, y: y + 1 });
  }
  const centreX = card.x + 232;
  const centreY = 196;
  for (let dy = -2; dy <= 2; dy++) {
    const radius = Math.abs(dy) === 2 ? 1 : 2;
    for (let dx = -radius; dx <= radius; dx++) points.push({ x: centreX + dx, y: centreY + dy });
  }
  return points;
};

const overlaps = (left, right) => (
  left.x < right.x + right.width && right.x < left.x + left.width
  && left.y < right.y + right.height && right.y < left.y + left.height
);

const within = (inner, outer) => (
  inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width
  && inner.y + inner.height <= outer.y + outer.height
);

const buildMotifProbes = (body, authoredCavity, openChimney) => {
  const probes = [];
  const firstTileX = Math.ceil(body.x / 32) * 32;
  const firstTileY = Math.ceil(body.y / 32) * 32;
  for (let tileY = firstTileY; tileY + 32 <= body.y + body.height; tileY += 32) {
    for (let tileX = firstTileX; tileX + 32 <= body.x + body.width; tileX += 32) {
      const probe = {
        tileOrigin: { x: tileX, y: tileY },
        ridge: { x: tileX + 26, y: tileY + 1, width: 1, height: 1 },
        fold: { x: tileX + 3, y: tileY + 3, width: 1, height: 1 },
        bloom: { x: tileX + 8, y: tileY + 1, width: 1, height: 1 },
        joint: { x: tileX + 12, y: tileY + 12, width: 1, height: 1 },
        interstitial: { x: tileX + 10, y: tileY + 8, width: 1, height: 1 },
      };
      const regions = [probe.ridge, probe.fold, probe.bloom, probe.joint, probe.interstitial];
      if (regions.every((region) => (
        within(region, body) && !overlaps(region, authoredCavity) && !overlaps(region, openChimney)
      ))) probes.push(probe);
    }
  }
  return probes;
};

const definitions = [
  { material: 27, code: 'WAX', color: '#e0c278', phase: 'solid' },
  { material: 59, code: 'MWAX', color: '#e0e0aa', phase: 'liquid' },
];
const layout = {
  columns: 2,
  rows: 1,
  origin: { x: 4, y: 4 },
  stride: { x: 304, y: 0 },
  cardSize: { width: 300, height: 376 },
};
const cards = definitions.map((definition, index) => {
  const card = {
    x: layout.origin.x + index * layout.stride.x,
    y: layout.origin.y,
    ...layout.cardSize,
  };
  const body = { x: 20 + index * 320, y: 20, width: 160, height: 128 };
  const authoredCavity = { x: body.x + 72, y: body.y + 54, width: 16, height: 14 };
  const openChimney = { x: body.x + 78, y: body.y, width: 4, height: 54 };
  return {
    ...definition,
    index,
    left: card.x,
    top: card.y,
    width: card.width,
    height: card.height,
    card,
    body,
    surfaceProbe: { x: body.x + 16, y: body.y + 8, width: 24, height: 12 },
    coreProbe: { x: body.x + 16, y: body.y + 100, width: 24, height: 12 },
    authoredCavity,
    openChimney,
    haloOuter: { x: body.x - 6, y: body.y - 6, width: body.width + 12, height: body.height + 12 },
    phaseStructureKind: definition.phase === 'solid' ? 'lamella-spur' : 'strand-droplets',
    phaseStructure: definition.phase === 'solid'
      ? buildSolidStructure(card, body)
      : buildLiquidStructure(card, body),
    isolated: { x: card.x + 270, y: 48 },
    guardedBlank: { x: card.x + 208, y: 306, width: 72, height: 50 },
    waterContact: {
      owner: { x: card.x + 20, y: 260, width: 16, height: 20 },
      neighbour: { x: card.x + 36, y: 260, width: 20, height: 20 },
      neighbourMaterial: 2,
    },
    metalContact: {
      owner: { x: card.x + 104, y: 260, width: 16, height: 20 },
      neighbour: { x: card.x + 120, y: 260, width: 20, height: 20 },
      neighbourMaterial: 23,
    },
    // Material-lighting receipts own emission-alpha evidence. This control is
    // projected only by the dedicated app fixture wrapper, never the legacy
    // WAX/MWAX audit preparer.
    warmEmitter: { x: card.x + 244, y: 260, width: 20, height: 20 },
    motifProbes: buildMotifProbes(body, authoredCavity, openChimney),
  };
});

const namedRegion = (name, role, rect) => ({ name, role, ...rect });
const inspectionRegions = cards.flatMap((card) => {
  const name = card.code.toLowerCase();
  const firstMotif = card.motifProbes[0];
  return [
    namedRegion(`${name}-body`, 'response', card.body),
    namedRegion(`${name}-surface`, 'response', card.surfaceProbe),
    namedRegion(`${name}-core`, 'response', card.coreProbe),
    namedRegion(`${name}-motif`, 'response', firstMotif.bloom),
    namedRegion(`${name}-authored-cavity`, 'control', card.authoredCavity),
    namedRegion(`${name}-open-chimney`, 'control', card.openChimney),
    namedRegion(`${name}-isolated`, 'control', { ...card.isolated, width: 1, height: 1 }),
    namedRegion(`${name}-water-contact`, 'control', {
      x: card.waterContact.owner.x,
      y: card.waterContact.owner.y,
      width: card.waterContact.owner.width + card.waterContact.neighbour.width,
      height: card.waterContact.owner.height,
    }),
    namedRegion(`${name}-metal-contact`, 'control', {
      x: card.metalContact.owner.x,
      y: card.metalContact.owner.y,
      width: card.metalContact.owner.width + card.metalContact.neighbour.width,
      height: card.metalContact.owner.height,
    }),
    namedRegion(`${name}-warm-emitter`, 'control', card.warmEmitter),
    namedRegion(`${name}-guarded-blank`, 'control', card.guardedBlank),
  ];
});

export const WAX_MATERIAL_LIGHTING_ATLAS_CATALOG = deepFreeze({
  schema: WAX_MATERIAL_LIGHTING_ATLAS_CATALOG_SCHEMA,
  atlases: [{
    candidate: 'wax-material-lighting-atlas',
    world: { width: 612, height: 384 },
    descriptor: {
      materials: { empty: 0, water: 2, metal: 23, wax: 27, mwax: 59 },
      definitions,
      layout,
      cards,
      inspectionRegions,
    },
  }],
});
