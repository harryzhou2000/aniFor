import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  createVisualLabCaptureRecipeCatalog,
  resolveVisualLabCaptureRecipe,
  VISUAL_LAB_CAPTURE_RECIPES,
  visualLabCaptureRecipeNames,
} from './visual-lab-recipes.mjs';
import { VISUAL_LAB_STATIC_CONTRACT } from '../src/shared/visual-lab-static-contract.js';

const validRecipe = Object.freeze({
  name: 'custom-gas',
  domain: 'gas',
  target: 1,
  fixture: 'showcase',
  gain: 1,
  renderScale: 2,
});

const createOne = (changes = {}) => createVisualLabCaptureRecipeCatalog([
  { ...validRecipe, ...changes },
]);

describe('Visual Lab capture recipes', () => {
  it('publishes the canonical recipes in stable order with exact data-only content', () => {
    expect(VISUAL_LAB_CAPTURE_RECIPES).toEqual([
      {
        name: 'gas-showcase', domain: 'gas', target: 0,
        fixture: 'showcase', gain: 1, renderScale: 2,
      },
      {
        name: 'oxygen-showcase', domain: 'gas', target: 4,
        fixture: 'showcase', gain: 1, renderScale: 2,
      },
      {
        name: 'oil-motion', domain: 'liquid', target: 8,
        fixture: 'oil-motion', gain: 1, renderScale: 2,
      },
      {
        name: 'water-motion', domain: 'liquid', target: 2,
        fixture: 'water-motion', gain: 1, renderScale: 2,
      },
      {
        name: 'powder-style-atlas', domain: 'powder', target: 0,
        fixture: 'powder-style-atlas', gain: 1, renderScale: 2,
      },
      {
        name: 'material-lighting-atlas', domain: 'material-lighting', target: 0,
        fixture: 'material-lighting-atlas', gain: 1, renderScale: 2,
      },
    ]);
    expect(visualLabCaptureRecipeNames()).toEqual([
      'gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion',
      'powder-style-atlas', 'material-lighting-atlas',
    ]);
    expect(resolveVisualLabCaptureRecipe('water-motion'))
      .toBe(VISUAL_LAB_CAPTURE_RECIPES[3]);
    expect(VISUAL_LAB_CAPTURE_RECIPES).not.toBe(VISUAL_LAB_STATIC_CONTRACT.captureRecipes);
    expect(VISUAL_LAB_CAPTURE_RECIPES[0])
      .not.toBe(VISUAL_LAB_STATIC_CONTRACT.captureRecipes[0]);
  });

  it('returns a deeply frozen JSON-safe catalog detached from its inputs', () => {
    const input = { ...validRecipe };
    const catalog = createVisualLabCaptureRecipeCatalog([input]);

    expect(catalog).not.toBe(VISUAL_LAB_CAPTURE_RECIPES);
    expect(catalog[0]).not.toBe(input);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog[0])).toBe(true);
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
    expect(Reflect.ownKeys(catalog[0])).toEqual([
      'name', 'domain', 'target', 'fixture', 'gain', 'renderScale',
    ]);

    input.target = 7;
    expect(catalog[0].target).toBe(1);

    const names = visualLabCaptureRecipeNames();
    names.pop();
    expect(visualLabCaptureRecipeNames()).toHaveLength(6);
  });

  it('requires an array of exact data objects', () => {
    expect(() => createVisualLabCaptureRecipeCatalog(null))
      .toThrow('catalog entries must be an array');
    for (const entry of [null, undefined, 'recipe', []]) {
      expect(() => createVisualLabCaptureRecipeCatalog([entry]))
        .toThrow('must be a data object');
    }
    expect(() => createVisualLabCaptureRecipeCatalog(new Array(1)))
      .toThrow('recipe at index 0 must be a data object');
    const { gain: _gain, ...missingGain } = validRecipe;
    expect(() => createVisualLabCaptureRecipeCatalog([missingGain]))
      .toThrow('missing gain');
    expect(() => createOne({ note: 'not part of the recipe ABI' }))
      .toThrow('unexpected "note"');
  });

  it('rejects unsafe or duplicate recipe names', () => {
    for (const name of [
      '', 'Gas', 'gas_showcase', 'gas/showcase', '-gas', 'gas-',
      'gas--showcase', 'gas showcase',
    ]) {
      expect(() => createOne({ name })).toThrow('name must be safe kebab-case');
    }
    expect(createOne({ name: '2x-gas' })[0].name).toBe('2x-gas');
    expect(() => createVisualLabCaptureRecipeCatalog([
      validRecipe,
      { ...validRecipe },
    ])).toThrow('Duplicate Visual Lab capture recipe name "custom-gas"');
  });

  it('requires an integer byte target', () => {
    for (const target of [-1, 256, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      expect(() => createOne({ target })).toThrow('target must be an integer from 0 through 255');
    }
    expect(createOne({ target: 0 })[0].target).toBe(0);
    expect(createOne({ target: 255 })[0].target).toBe(255);
  });

  it('requires a finite positive gain no greater than two', () => {
    for (const gain of [0, -0.1, 2.01, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      expect(() => createOne({ gain }))
        .toThrow('gain must be a finite number greater than 0 and at most 2');
    }
    expect(createOne({ gain: Number.MIN_VALUE })[0].gain).toBe(Number.MIN_VALUE);
    expect(createOne({ gain: 2 })[0].gain).toBe(2);
  });

  it('resolves only existing domains and compatible fixtures and targets', () => {
    expect(() => createOne({ domain: 'unknown' }))
      .toThrow('has an unknown domain: --domain must be gas, liquid, emission, powder, or material-lighting');
    expect(() => createOne({ domain: 'powder' }))
      .toThrow('has an incompatible fixture: --fixture=showcase requires --domain');
    expect(createOne({
      domain: 'powder', target: 0, fixture: 'powder-style-atlas',
    })[0]).toMatchObject({ domain: 'powder', target: 0, fixture: 'powder-style-atlas' });
    expect(() => createOne({ fixture: 'missing' }))
      .toThrow(
        'has an incompatible fixture: --fixture must be showcase, oil-motion, water-motion,'
        + ' powder-style-atlas, or material-lighting-atlas',
      );
    expect(() => createOne({ fixture: 'oil-motion', domain: 'gas', target: 8 }))
      .toThrow('--fixture=oil-motion requires --domain=liquid --target=8');
    expect(() => createOne({
      fixture: 'oil-motion', domain: 'liquid', target: 2,
    })).toThrow('--fixture=oil-motion requires --domain=liquid --target=8');
    expect(createOne({
      fixture: 'oil-motion', domain: 'liquid', target: 8,
    })[0]).toMatchObject({ fixture: 'oil-motion', domain: 'liquid', target: 8 });
  });

  it('accepts only Detail scales supported by the resolved domain execution profile', () => {
    for (const renderScale of [0, 3, 8, '2', Number.NaN]) {
      expect(() => createOne({ renderScale }))
        .toThrow('renderScale must be supported by domain "gas" (1, 2, 4)');
    }
    for (const renderScale of [1, 2, 4]) {
      expect(createOne({ renderScale })[0].renderScale).toBe(renderScale);
    }
  });

  it('fails clearly when a named capture candidate is unknown', () => {
    expect(() => resolveVisualLabCaptureRecipe('missing'))
      .toThrow(
        'Unknown Visual Lab capture candidate "missing"; --candidate must be one of: '
        + 'gas-showcase, oxygen-showcase, oil-motion, water-motion, powder-style-atlas, material-lighting-atlas',
      );
    expect(() => resolveVisualLabCaptureRecipe(undefined))
      .toThrow('Unknown Visual Lab capture candidate undefined');
  });

  it('keeps candidate identity strict at the CLI boundary', () => {
    const auditScript = new URL('./visual-lab-audit.mjs', import.meta.url);
    for (const [arguments_, message] of [
      [
        ['--candidate=water-motion', '--domain=liquid'],
        '--candidate=water-motion owns --domain, --target, --fixture, --gain, --render-scale;'
        + ' remove conflicting --domain',
      ],
      [
        ['--candidate=water-motion', '--render-scale=2'],
        'remove conflicting --render-scale',
      ],
      [
        ['--candidate=missing'],
        'Unknown Visual Lab capture candidate "missing"',
      ],
      [
        ['--domain=gas', '--domain=gas'],
        'Option --domain may only be provided once',
      ],
      [
        [
          '--candidate=gas-showcase',
          `--execution-plan-id=sha256:${'0'.repeat(64)}`,
          '--chrome=/definitely/missing/chrome',
        ],
        'Visual capture execution plan mismatch',
      ],
    ]) {
      const child = spawnSync(process.execPath, [auditScript.pathname, ...arguments_], {
        encoding: 'utf8', timeout: 5_000,
      });
      expect(child.status).toBe(1);
      expect(JSON.parse(child.stderr).error).toContain(message);
    }
  });
});
