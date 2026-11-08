import { type Band, bandFor, MAX_POINTS } from './score';

export const BAND_EMOJI: Record<Band, string> = {
  whopper: '🐳',
  prize: '🐟',
  keeper: '🐠',
  minnow: '🦐',
  boot: '🥾',
};

const fmt = (n: number) => n.toLocaleString('en-US');

export function shareText(dayNumber: number, results: { km: number; points: number }[]): string {
  const total = results.reduce((sum, r) => sum + r.points, 0);
  const max = results.length * MAX_POINTS;
  const catches = results.map((r) => BAND_EMOJI[bandFor(r.km)]).join('');
  return `Glub No. ${dayNumber} · ${fmt(total)} / ${fmt(max)}\n${catches}\nglub glub`;
}
