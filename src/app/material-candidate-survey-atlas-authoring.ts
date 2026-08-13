import type { Material } from '../shared/materials';
import type {
  MaterialCandidateSurveyCommand,
} from '../shared/material-candidate-survey-atlas-catalog.js';

export interface MaterialCandidateSurveyPlotter {
  roundedRect(x: number, y: number, width: number, height: number, radius: number,
    material: Material): void;
  eraseRect(x: number, y: number, width: number, height: number): void;
  wallPatternRect(x: number, y: number, width: number, height: number, blockSize: number): void;
  rect(x: number, y: number, width: number, height: number, material: Material,
    density?: number, seed?: number): void;
}

const number = (operation: MaterialCandidateSurveyCommand, field: string): number => {
  const value = operation[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Material candidate-survey command has invalid ${field}`);
  }
  return value;
};

/** Validates and executes the closed candidate-survey command vocabulary. */
export function prepareMaterialCandidateSurveyAtlas(
  plot: MaterialCandidateSurveyPlotter,
  commands: readonly MaterialCandidateSurveyCommand[],
): void {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new TypeError('Material candidate-survey authoring is malformed');
  }
  for (const operation of commands) {
    switch (operation.kind) {
      case 'rounded-rect':
        plot.roundedRect(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'), number(operation, 'radius'), number(operation, 'material') as Material);
        break;
      case 'erase-rect':
        plot.eraseRect(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'));
        break;
      case 'wall-pattern-rect':
        plot.wallPatternRect(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'), number(operation, 'blockSize'));
        break;
      case 'rect':
        plot.rect(number(operation, 'x'), number(operation, 'y'), number(operation, 'width'),
          number(operation, 'height'), number(operation, 'material') as Material,
          number(operation, 'density'), number(operation, 'seed'));
        break;
      default:
        throw new TypeError(
          `Unknown material candidate-survey command ${JSON.stringify(operation.kind)}`,
        );
    }
  }
}
