/** Deliberately unhinged effects. Every one of them is skipped when reduced motion is on. */

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Restart a one-shot CSS animation class on an element: `quake` shakes, `quake-hard` really shakes. */
export function shake(el: Element | null, cls: 'quake' | 'quake-hard' = 'quake') {
  if (!el || reducedMotion()) return;
  el.classList.remove('quake', 'quake-hard');
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

const WORDS = ['GLUB', 'GLUB!', 'glub', 'GLUB GLUB', 'blub', 'GLUB!!', 'glub?'];
const COLORS = ['var(--coral)', 'var(--ink)', 'var(--teal)', 'var(--cel)', 'var(--teal-deep)', 'var(--coral-text)'];

/** Spray GLUBs out of a point on screen. */
export function burst(x: number, y: number, count = 28) {
  if (reducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const word = document.createElement('span');
    const angle = Math.random() * Math.PI * 2;
    const dist = 140 + Math.random() * 460;
    word.className = 'fx-glub';
    word.textContent = WORDS[i % WORDS.length];
    word.style.left = `${x}px`;
    word.style.top = `${y}px`;
    word.style.color = COLORS[i % COLORS.length];
    word.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    word.style.setProperty('--dy', `${Math.sin(angle) * dist - 160}px`);
    word.style.setProperty('--r', `${(Math.random() - 0.5) * 1440}deg`);
    word.style.setProperty('--s', `${0.7 + Math.random() * 2.2}`);
    word.style.animationDelay = `${Math.random() * 90}ms`;
    layer.append(word);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1500);
}

/** Bands of GLUB GLUB GLUB sweep across the whole screen. `onCovered` runs while the screen is hidden. */
export function flood(onCovered: () => void) {
  if (reducedMotion()) {
    onCovered();
    return;
  }
  const layer = document.createElement('div');
  layer.className = 'fx-flood';
  layer.setAttribute('aria-hidden', 'true');
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('div');
    row.className = `fx-flood-row ${i % 2 ? 'from-right' : 'from-left'}`;
    row.style.animationDelay = `${i * 45}ms`;
    row.textContent = 'GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB GLUB';
    layer.append(row);
  }
  document.body.append(layer);
  setTimeout(onCovered, 760);
  setTimeout(() => layer.remove(), 1700);
}
