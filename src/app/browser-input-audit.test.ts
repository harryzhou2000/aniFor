import { describe, expect, it } from 'vitest';
import { browserInputAuditRequested } from './browser-input-audit';

describe('browser input audit gate', () => {
  it('requires the explicit diagnostic query', () => {
    expect(browserInputAuditRequested('?scene=render-lab&inputAudit=1')).toBe(true);
    expect(browserInputAuditRequested('?scene=render-lab')).toBe(false);
    expect(browserInputAuditRequested('?inputAudit=0')).toBe(false);
  });
});
