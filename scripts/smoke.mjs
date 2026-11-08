/**
 * End-to-end smoke test against `npm run preview`.
 * - Plays a full day on desktop and on a phone-sized touch screen.
 * - Checks: a drag doesn't drop a pin, a double-click can't skip a reveal, the fifth cast goes
 *   straight to the results, the front-page button works, a reload resumes.
 * - Audits layout at several widths: no sideways scroll, no clipped text. Reports page heights.
 * - Saves screenshots to .impeccable/review/.
 * Usage: npm run build && npm run preview & npm run smoke
 */
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const URL = process.env.GLUB_URL ?? 'http://localhost:4173/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '.impeccable/review';
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
function assert(ok, message) {
  if (!ok) throw new Error(`smoke failed: ${message}`);
}

/**
 * Text that spills out of its box, and any sideways page scroll. Measured with motion reduced,
 * so wobbling letters and swaying cards don't count; small static tilts (a few px) are allowed.
 */
async function audit(page, where) {
  await page.mouse.move(0, 0);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await sleep(150);
  const found = await page.evaluate(() => {
    const out = [];
    const skip = (el) => el.closest('.wallpaper, .ticker, svg, .fx-layer, .fx-flood, .visually-hidden');
    for (const el of document.querySelectorAll('body *')) {
      if (skip(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' || cs.display === 'contents' || cs.overflowX !== 'visible') continue;
      if (el.scrollWidth > el.clientWidth + 6 && el.clientWidth > 0) {
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => !c.startsWith('svelte-')).join('.')} ${el.scrollWidth}>${el.clientWidth} "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}"`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${innerWidth})`);
    return out;
  });
  for (const f of found) problems.push(`${where}: ${f}`);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

const pageHeight = (page) => page.evaluate(() => document.documentElement.scrollHeight);

async function chartBox(page) {
  await page.waitForSelector('main svg[role=application]');
  await sleep(700);
  await page.$eval('main svg[role=application]', (el) => el.scrollIntoView({ block: 'start' }));
  await sleep(300);
  return (await page.$('main svg[role=application]')).boundingBox();
}

const castDisabled = (page) => page.$eval('button.coupon', (b) => b.disabled);

async function startRound(page) {
  await page.waitForSelector('button.coupon');
  await page.click('button.coupon');
  await page.waitForSelector('#round-heading');
}

async function playDay(page, { tap, shots, width }) {
  for (let i = 0; i < 5; i++) {
    const box = await chartBox(page);
    const x = box.x + box.width * (0.25 + 0.12 * i);
    const y = box.y + box.height * 0.45;
    if (tap) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await sleep(200);
    assert(!(await castDisabled(page)), `fish ${i + 1}: Cast should be enabled after placing a pin`);
    if (i === 0 && shots) {
      await sleep(900);
      await audit(page, `${width} aim`);
      await page.screenshot({ path: `${OUT}/${shots}-aim.png`, fullPage: true });
    }
    // A double-click on Cast must not skip the reveal, including on the fifth fish.
    await page.click('button.coupon', { clickCount: 1 });
    await sleep(60);
    await page.click('button.coupon', { clickCount: 1 }).catch(() => {});
    await page.waitForSelector('#answer-heading');
    await sleep(1600);
    assert(await page.$('#answer-heading'), `fish ${i + 1}: the reveal was skipped by a double-click`);
    assert(
      (await page.$eval('.result', (el) => el.textContent)).includes('points'),
      `fish ${i + 1}: the reveal should show the score`,
    );
    if (i === 0 && shots) {
      await audit(page, `${width} reveal`);
      await page.screenshot({ path: `${OUT}/${shots}-reveal.png`, fullPage: true });
    }
    if (i < 4) {
      await page.click('button.coupon');
      await page.waitForSelector('#round-heading');
    } else {
      // The fifth fish shows its score first; the results come after a button press.
      const label = await page.$eval('button.coupon', (b) => b.textContent);
      assert(label.includes('See results'), `fish 5: expected a See results button, found "${label}"`);
      assert(!(await page.$('#summary-heading')), 'fish 5: the results appeared before the player asked for them');
      await page.click('button.coupon');
    }
  }
  await page.waitForSelector('#summary-heading', { timeout: 8000 });
  await page.waitForFunction(() => document.body.innerText.includes('/ 5,000'), { timeout: 8000 });
  await sleep(1200);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  // Layout audit of the front page and the aim screen at several sizes.
  const sizes = [
    [360, 740],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1280, 720],
    [1440, 800],
    [1920, 1080],
  ];
  for (const [w, h] of sizes) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
    await p.goto(URL, { waitUntil: 'networkidle0' });
    await p.waitForSelector('button.coupon');
    await sleep(1200);
    await audit(p, `${w}x${h} home`);
    const homeH = await pageHeight(p);
    await startRound(p);
    await chartBox(p);
    await sleep(1200);
    await audit(p, `${w}x${h} aim`);
    console.log(`${w}x${h}: home ${homeH}px tall, aim ${await pageHeight(p)}px tall (window ${h}px)`);
    await ctx.close();
  }

  // Desktop play-through: drag first (must not drop a pin), then the whole day.
  const desk = await browser.createBrowserContext();
  const page = await desk.newPage();
  await page.setViewport({ width: 1440, height: 800 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(800);
  await page.screenshot({ path: `${OUT}/desktop-home.png`, fullPage: true });
  await startRound(page);
  const box = await chartBox(page);
  await page.screenshot({ path: `${OUT}/desktop.png`, fullPage: true });
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 10 });
  await page.mouse.up();
  await sleep(150);
  assert(await castDisabled(page), 'a drag across the chart must not drop a pin');

  await playDay(page, { tap: false, shots: 'desktop', width: 1440 });
  await audit(page, '1440 summary');
  await page.screenshot({ path: `${OUT}/desktop-summary.png`, fullPage: true });
  await page.click('button.home');
  await page.waitForFunction(() => document.body.innerText.includes('Think you know fish?'));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('see results'));
  console.log('desktop ok: day played, drag ignored, double-click guarded, front page and reload work');

  // Archive: the last two weeks are playable, and don't touch the streak.
  const playedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('glub:v2:stats') ?? '{}').played);
  await page.click('button.back');
  await page.waitForSelector('.issues li');
  await sleep(900);
  const issues = await page.$$eval('.issues li', (els) => els.length);
  assert(issues === 14, `archive should list 14 back issues, found ${issues}`);
  await audit(page, '1440 archive');
  await page.screenshot({ path: `${OUT}/desktop-archive.png`, fullPage: true });
  // The newest back issue is yesterday's, whatever today's number is.
  const backNo = await page.$eval('.issues li:first-child .no', (el) => el.textContent.trim());
  await page.click('.issues li:first-child button');
  await page.waitForSelector('#round-heading');
  assert((await page.$eval('.masthead', (el) => el.textContent)).includes(backNo), 'a back issue shows its own number');
  await playDay(page, { tap: false, shots: '', width: 1440 });
  assert((await page.$eval('#summary-heading', (el) => el.textContent)).includes(backNo), 'back issue summary is labelled');
  await page.$$eval('button.home', (els) => els.find((b) => b.textContent.includes('Archive')).click());
  await page.waitForSelector('.issues li .done');
  const playedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('glub:v2:stats') ?? '{}').played);
  assert(playedAfter === playedBefore, 'a back issue must not count towards played or streak');
  console.log('archive ok: 14 back issues, one played, streak untouched');

  // Phone: a fresh context (fresh storage), touch taps.
  const phoneCtx = await browser.createBrowserContext();
  const phone = await phoneCtx.newPage();
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(800);
  await phone.screenshot({ path: `${OUT}/mobile-home.png`, fullPage: true });
  await startRound(phone);
  await chartBox(phone);
  await phone.screenshot({ path: `${OUT}/mobile.png`, fullPage: true });
  await playDay(phone, { tap: true, shots: 'mobile', width: 390 });
  await audit(phone, '390 summary');
  await phone.screenshot({ path: `${OUT}/mobile-summary.png`, fullPage: true });
  console.log('phone ok: day played with taps');

  if (problems.length) {
    console.log(`layout problems (${problems.length}):\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.log('layout ok: no clipped text or sideways scroll at any size');
  }
  console.log(process.exitCode ? 'smoke finished with layout problems' : 'smoke ok');
} finally {
  await browser.close();
}
