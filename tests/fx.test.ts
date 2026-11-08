// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flood } from '../src/lib/fx';

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({ matches: reduce, media: query })) as unknown as typeof window.matchMedia;
}

describe('flood', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    setReducedMotion(false);
  });
  afterEach(() => vi.useRealTimers());

  it('covers the screen after 380 ms, half the old 760 ms', () => {
    const onCovered = vi.fn();
    flood(onCovered);
    vi.advanceTimersByTime(379);
    expect(onCovered).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onCovered).toHaveBeenCalledOnce();
  });

  it('clears itself after 850 ms, half the old 1,700 ms', () => {
    flood(() => {});
    vi.advanceTimersByTime(849);
    expect(document.querySelector('.fx-flood')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector('.fx-flood')).toBeNull();
  });

  it('runs each row for 800 ms with a 22 ms stagger, half the old timing', () => {
    flood(() => {});
    const rows = [...document.querySelectorAll<HTMLElement>('.fx-flood-row')];
    expect(rows).toHaveLength(9);
    expect(rows[0].style.animationDuration).toBe('800ms');
    expect(rows[2].style.animationDelay).toBe('44ms');
  });

  it('skips straight to the result when the player prefers reduced motion', () => {
    setReducedMotion(true);
    const onCovered = vi.fn();
    flood(onCovered);
    expect(onCovered).toHaveBeenCalledOnce();
    expect(document.querySelector('.fx-flood')).toBeNull();
  });
});
