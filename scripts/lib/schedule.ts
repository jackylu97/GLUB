/** day number → the five fish ids dealt that day. */
export type Schedule = Record<number, string[]>;

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Append-only daily schedule. Days up to `frozenThroughDay` are copied verbatim, because people
 * have already played them. Each later day deals the least recently shown fish (never-shown
 * first), with a seeded tie-break. So new fish join soon, and nothing repeats until everything
 * else has had a turn.
 */
export function extendSchedule(
  existing: Schedule,
  fishIds: string[],
  frozenThroughDay: number,
  horizonDay: number,
  count = 5,
): Schedule {
  const out: Schedule = {};
  const lastShown = new Map<string, number>();
  const pool = [...new Set(fishIds)];
  const want = Math.min(count, pool.length);
  for (let day = 1; day <= horizonDay; day++) {
    if (day <= frozenThroughDay && existing[day]?.length) {
      out[day] = [...existing[day]];
      for (const id of out[day]) lastShown.set(id, day);
      continue;
    }
    const ranked = pool
      .map((id) => ({ id, last: lastShown.get(id) ?? -Infinity, tie: fnv1a(`${id}:${day}`) }))
      .sort((a, b) => a.last - b.last || a.tie - b.tie);
    out[day] = ranked.slice(0, want).map((r) => r.id);
    for (const id of out[day]) lastShown.set(id, day);
  }
  return out;
}
