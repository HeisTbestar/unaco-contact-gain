import { it, expect } from 'vitest';
import { track, trackingAllowed, initTracking } from './track';
it('is a safe no-op outside a browser', () => { expect(trackingAllowed()).toBe(false); expect(() => { track('pageview'); initTracking(); }).not.toThrow(); });
