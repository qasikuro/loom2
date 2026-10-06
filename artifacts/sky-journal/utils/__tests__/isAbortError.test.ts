import { describe, expect, it } from 'vitest';
import { isAbortError } from '../isAbortError';

describe('isAbortError', () => {
  it('recognizes abort errors by name without relying on DOMException', () => {
    const error = new Error('cancelled');
    error.name = 'AbortError';

    expect(isAbortError(error)).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new Error('different error'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
