import { Material, type MaterialInfo } from '../shared/materials';

/** Static cross-phase roles packed into the existing render-style alpha byte. */
export const enum RenderTrait {
  Emitter = 1 << 0,
  Sink = 1 << 1,
  Channel = 1 << 2,
  Force = 1 << 3,
  Radioactive = 1 << 4,
  Organic = 1 << 5,
  Fibrous = 1 << 6,
  Carrier = 1 << 7,
}

export function renderTraits(material: Pick<MaterialInfo, 'id' | 'category'>): number {
  let traits = 0;
  if (material.category === 'radioactive') traits |= RenderTrait.Radioactive;
  if (material.category === 'life' || isOrganic(material.id)) traits |= RenderTrait.Organic;
  if (isFibrous(material.id)) traits |= RenderTrait.Fibrous;
  if (isEmitter(material.id)) traits |= RenderTrait.Emitter;
  if (isSink(material.id)) traits |= RenderTrait.Sink;
  if (isChannel(material.id)) traits |= RenderTrait.Channel;
  if (isForce(material.id)) traits |= RenderTrait.Force;
  if (isCarrier(material.id)) traits |= RenderTrait.Carrier;
  return traits;
}

export function hasRenderTrait(traits: number, trait: RenderTrait): boolean {
  return (traits & trait) !== 0;
}

function isFibrous(id: Material): boolean {
  return id === Material.Wood || id === Material.VINE;
}

function isOrganic(id: Material): boolean {
  return id === Material.VIRS || id === Material.VRSG || id === Material.VRSS;
}

function isEmitter(id: Material): boolean {
  switch (id) {
    case Material.BCLN: case Material.CLNE: case Material.PBCN: case Material.PCLN:
    case Material.CONV: case Material.PRTO: case Material.NWHL: case Material.WHOL:
    case Material.ARAY: case Material.CRAY: case Material.DRAY: case Material.BTRY:
    case Material.ETRD: case Material.TESC: case Material.FRAY:
      return true;
    default: return false;
  }
}

function isSink(id: Material): boolean {
  switch (id) {
    case Material.CONV: case Material.PRTI: case Material.BHOL: case Material.NBHL:
    case Material.SING: case Material.VOID: case Material.PVOD: case Material.STOR:
      return true;
    default: return false;
  }
}

function isChannel(id: Material): boolean {
  switch (id) {
    case Material.PRTI: case Material.PRTO: case Material.PIPE: case Material.PPIP:
    case Material.STOR: case Material.WIFI:
      return true;
    default: return false;
  }
}

function isForce(id: Material): boolean {
  switch (id) {
    case Material.ACEL: case Material.DCEL: case Material.DMG: case Material.FRAY:
    case Material.GBMB: case Material.PSTN: case Material.RPEL: case Material.BHOL: case Material.NBHL:
    case Material.NWHL: case Material.WHOL: case Material.GPMP: case Material.PUMP:
    case Material.GRVT: case Material.SING:
      return true;
    default: return false;
  }
}

function isCarrier(id: Material): boolean {
  switch (id) {
    case Material.ELEC: case Material.GRVT: case Material.NEUT: case Material.PHOT:
    case Material.PROT: case Material.SPRK: case Material.CFLM: case Material.LIGH: case Material.THDR:
    case Material.BRAY: case Material.EMBR:
      return true;
    default: return false;
  }
}
