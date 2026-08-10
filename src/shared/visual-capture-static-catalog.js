/**
 * Capture-facing, data-only projection of the two frozen static contracts.
 *
 * The Visual Lab contract remains the closed normal-HDR renderer registry and
 * the capture contract remains its additive driver extension.  Consumers that
 * merely need fixture/recipe ownership must use this projection instead of
 * repeating that join and re-inferring the normal-HDR driver.
 */

import { VISUAL_CAPTURE_STATIC_CONTRACT } from './visual-capture-static-contract.js';
import { VISUAL_LAB_STATIC_CONTRACT } from './visual-lab-static-contract.js';

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const catalog = {
  schema: 'anifor.visual-capture.static-catalog/v1',
  fixtures: [
    ...VISUAL_LAB_STATIC_CONTRACT.fixtures.map((fixture) => ({
      ...fixture,
      driver: 'normal-hdr',
    })),
    ...VISUAL_CAPTURE_STATIC_CONTRACT.fixtures,
  ],
  captureRecipes: [
    ...VISUAL_LAB_STATIC_CONTRACT.captureRecipes,
    ...VISUAL_CAPTURE_STATIC_CONTRACT.captureRecipes,
  ],
};

const validateCatalog = (candidate) => {
  const drivers = new Map(
    VISUAL_CAPTURE_STATIC_CONTRACT.drivers.map((driver) => [driver.name, driver]),
  );
  const fixtures = new Map();
  for (const fixture of candidate.fixtures) {
    const driver = drivers.get(fixture.driver);
    if (!driver || fixtures.has(fixture.name) || !Array.isArray(fixture.constraints)) {
      throw new TypeError(`invalid or duplicate visual capture fixture ${JSON.stringify(fixture.name)}`);
    }
    for (const constraint of fixture.constraints) {
      if (!driver.domains.includes(constraint.domain)) {
        throw new TypeError(
          `visual capture fixture ${fixture.name} driver ${fixture.driver}`
          + ` does not support ${JSON.stringify(constraint.domain)}`,
        );
      }
    }
    fixtures.set(fixture.name, fixture);
  }
  const recipes = new Set();
  for (const recipe of candidate.captureRecipes) {
    const fixture = fixtures.get(recipe.fixture);
    if (!fixture || recipes.has(recipe.name)
      || !fixture.constraints.some(({ domain, targets }) => (
        domain === recipe.domain && (targets === null || targets.includes(recipe.target))
      ))) {
      throw new TypeError(`invalid visual capture recipe ${JSON.stringify(recipe.name)}`);
    }
    recipes.add(recipe.name);
  }
};

validateCatalog(catalog);

const frozenCatalog = deepFreeze(catalog);

export const VISUAL_CAPTURE_STATIC_CATALOG = frozenCatalog;
export const VISUAL_CAPTURE_STATIC_FIXTURES = frozenCatalog.fixtures;
export const VISUAL_CAPTURE_STATIC_RECIPES = frozenCatalog.captureRecipes;
