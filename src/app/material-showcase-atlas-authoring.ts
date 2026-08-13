import type { Material } from '../shared/materials';
import type { MaterialShowcaseCommand } from '../shared/material-showcase-atlas-catalog.js';

export interface MaterialShowcasePlotter {
  roundedRect(x: number, y: number, width: number, height: number, radius: number, material: Material): void;
  eraseRect(x: number, y: number, width: number, height: number): void;
  slope(x: number, bottom: number, width: number, height: number, material: Material): void;
  splitCapsule(x: number, y: number, width: number, height: number, radius: number,
    splitX: number, left: Material, right: Material): void;
  rect(x: number, y: number, width: number, height: number, material: Material,
    density?: number, seed?: number): void;
  ellipse(cx: number, cy: number, radiusX: number, radiusY: number, material: Material,
    density: number, seed: number, feather: number): void;
  curvaturePlate(x: number, y: number, width: number, height: number, radius: number,
    material: Material): void;
}

const number = (command: MaterialShowcaseCommand, field: string): number => {
  const value = command[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Material showcase command has invalid ${field}`);
  }
  return value;
};
const material = (command: MaterialShowcaseCommand, field = 'material'): Material => (
  number(command, field) as Material
);

/** Validates and direct-fills the frozen showcase command stream. */
export function prepareMaterialShowcaseAtlas(
  plot: MaterialShowcasePlotter,
  commands: readonly MaterialShowcaseCommand[],
): void {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new TypeError('Material showcase authoring is malformed');
  }
  for (const operation of commands) {
    switch (operation.kind) {
      case 'rounded-rect':
        plot.roundedRect(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'), number(operation, 'radius'), material(operation));
        break;
      case 'erase-rect':
        plot.eraseRect(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'));
        break;
      case 'slope':
        plot.slope(number(operation, 'x'), number(operation, 'bottom'), number(operation, 'width'),
          number(operation, 'height'), material(operation));
        break;
      case 'split-capsule':
        plot.splitCapsule(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'), number(operation, 'radius'), number(operation, 'splitX'),
          material(operation, 'left'), material(operation, 'right'));
        break;
      case 'rect':
        plot.rect(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'), material(operation), number(operation, 'density'),
          number(operation, 'seed'));
        break;
      case 'ellipse':
        plot.ellipse(number(operation, 'cx'), number(operation, 'cy'), number(operation, 'radiusX'),
          number(operation, 'radiusY'), material(operation), number(operation, 'density'),
          number(operation, 'seed'), number(operation, 'feather'));
        break;
      case 'curvature-plate':
        plot.curvaturePlate(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'), number(operation, 'radius'), material(operation));
        break;
      default:
        throw new TypeError(`Unknown material showcase command ${JSON.stringify(operation.kind)}`);
    }
  }
}
