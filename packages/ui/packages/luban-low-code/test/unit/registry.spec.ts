import { describe, it, expect } from 'vitest';
import { getComponent } from '../../src/lib/registry';

describe('luban-low-code registry', () => {
  it('returns component for LubanButton', () => {
    const Comp = getComponent('LubanButton');
    expect(Comp).toBeDefined();
  });

  it('returns undefined for unknown type', () => {
    expect(getComponent('Unknown')).toBeUndefined();
  });
});

