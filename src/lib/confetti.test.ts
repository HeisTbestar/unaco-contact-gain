import { it, expect } from 'vitest';
import { celebrate } from './confetti';
it('is a safe no-op outside a browser', () => expect(() => celebrate()).not.toThrow());
