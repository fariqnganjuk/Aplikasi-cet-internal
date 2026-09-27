const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const log = [];
  let pass = 0, fail = 0;
  const check = (n, ok, extra = '') => { log.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' -> ' + extra : ''}`); ok ? pass++ : fail++; };

  // Context bersih: tanpa localStorage
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const bad = [];
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

  const snap = () => page.evaluate(() => {
    const img = document.querySelector('img[alt="Akselera.Tech"]');
    return {
      dark: document.documentElement.classList.contains('dark'),
      src: img ? img.getAttribute('src') : null,
      loaded: img ? img.complete && img.naturalWidth > 0 : false,
      natural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
    };
  });
  const toggle = () => page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('button'))
      .find((x) => /Light Mode|Dark Mode/.test(x.getAttribute('aria-label') || ''));
    t?.click();
  });

  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000);

  const s1 = await snap();
  check('Logo sesuai tema saat load', s1.src.endsWith(s1.dark ? 'logo-white.png' : 'logo-black.png'), JSON.stringify(s1));
  check('Logo ter-load (bukan broken)', s1.loaded, `natural ${s1.natural}`);

  await toggle(); await wait(2000);
  const s2 = await snap();
  check('Toggle 1x -> logo ikut tema', s2.src.endsWith(s2.dark ? 'logo-white.png' : 'logo-black.png'), JSON.stringify(s2));

  await toggle(); await wait(2000);
  const s3 = await snap();
  check('Toggle 2x -> logo ikut tema', s3.src.endsWith(s3.dark ? 'logo-white.png' : 'logo-black.png'), JSON.stringify(s3));
  check('Toggle balik ke awal', s3.dark === s1.dark && s3.src === s1.src);

  // Persist: reload harus ingat tema + logo
  const beforeReload = await snap();
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000);
  const s4 = await snap();
  check('Tema & logo persist setelah reload', s4.dark === beforeReload.dark && s4.src === beforeReload.src, JSON.stringify(s4));

  check('Tidak ada resource 404', bad.length === 0, bad.join(', ') || 'bersih');

  await browser.close();
  log.push('');
  log.push(`=== ${pass} PASS / ${fail} FAIL ===`);
  console.log(log.join('\n'));
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
