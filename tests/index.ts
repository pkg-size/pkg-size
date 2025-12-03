import { describe, expect } from 'manten';
import pkgSize from '../src/index.js';

describe('pkg-size', ({ test }) => {
  test('exports a function', () => {
    expect(typeof pkgSize).toBe('function');
  });
});