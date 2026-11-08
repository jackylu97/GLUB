import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyGuess, currentIndex, newDay } from '../src/lib/game';

/** Each test gets a fresh storage module, so the in-memory fallback starts empty. */
async function storage() {
  vi.resetModules();
  return import('../src/lib/storage');
}

const range = { cells: [], anchors: [{ lat: 0, lng: 0, radiusKm: 10 }] };

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

function throwingStorage(): Storage {
  const fail = () => { throw new Error('SecurityError: storage is disabled'); };
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail };
}

afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('resumes a half-played day', async () => {
    const { loadDay, saveDay } = await storage();
    vi.stubGlobal('localStorage', memoryStorage());
    let s = newDay(7, ['a', 'b', 'c', 'd', 'e']);
    s = applyGuess(applyGuess(s, { lat: 1, lng: 1 }, range), { lat: 0, lng: 0 }, range);
    saveDay(s);
    const loaded = loadDay(7);
    expect(loaded && currentIndex(loaded)).toBe(2);
    expect(loadDay(8)).toBeNull();
  });

  it('keeps working when storage throws', async () => {
    const { loadDay, loadStats, saveDay, saveStats } = await storage();
    vi.stubGlobal('localStorage', throwingStorage());
    const s = applyGuess(newDay(9, ['a', 'b']), { lat: 0, lng: 0 }, range);
    expect(() => saveDay(s)).not.toThrow();
    expect(loadDay(9)).toEqual(s);
    saveStats({ played: 1, streak: 1, best: 1000, lastDay: 9 });
    expect(loadStats().played).toBe(1);
  });

  it('reads the newest save when storage starts failing mid-session', async () => {
    const { loadDay, saveDay } = await storage();
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    const day = newDay(11, ['a', 'b']);
    saveDay(day);
    store.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const later = applyGuess(day, { lat: 0, lng: 0 }, range);
    saveDay(later);
    expect(loadDay(11)).toEqual(later);
  });

  it('ignores corrupt saved data', async () => {
    const { loadDay, loadStats } = await storage();
    const store = memoryStorage();
    store.setItem('glub:v2:day:3', '{not json');
    store.setItem('glub:v2:stats', '"nope"');
    vi.stubGlobal('localStorage', store);
    expect(loadDay(3)).toBeNull();
    expect(loadStats()).toEqual({ played: 0, streak: 0, best: 0, lastDay: 0 });
  });
});
