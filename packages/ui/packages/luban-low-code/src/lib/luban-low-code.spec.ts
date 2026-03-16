import { describe, it, expect } from 'vitest';
import { getComponent } from './registry';

describe('luban-low-code', () => {
  it('registry returns component for LubanButton', () => {
    const Comp = getComponent('LubanButton');
    expect(Comp).toBeDefined();
  });

  it('registry returns undefined for unknown type', () => {
    expect(getComponent('Unknown')).toBeUndefined();
  });
});
