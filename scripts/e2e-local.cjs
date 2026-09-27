const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Tunggu React hydrate: SSR sudah kirim HTML, kita tunggu agar
// event handler terpasang (React 19 attaching listeners).
async function hydrated(page, selector) {
  try {
    await page.waitForFunction((sel) => !!document.querySelector(sel), { timeout: 20000 }, selector);
  } catch (e) {
    const st = await page.evaluate(() => ({ url: location.href, has: !!document.querySelector('#email'), body: document.body.innerText.slice(0, 80) })).catch(() => null);
    throw new Error(`hydrated(${selector}) gagal: ${e.message} | state=${JSON.stringify(st)}`);
  }
  await wait(2500);
}

async function login(page, demoName) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await hydrated(page, '#email');

  // Ketik sungguhan via keyboard (meniru user asli)
  const email = demoName === 'Rina Kartika' ? 'rina@contoh.id' : 'andi@contoh.id';
  await page.focus('#email');
  await page.keyboard.type(email);
  await page.focus('#password');
  await page.keyboard.type('password123');
  await page.keyboard.press('Enter');

  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {}
  await wait(3000);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const log = [];
  let pass = 0, fail = 0;
  const check = (name, ok, extra = '') => {
    log.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' -> ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // === 1. Guard tanpa login ===
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 30000 });
  check('Wajib #1: / tanpa login -> /login', page.url().includes('/login'), page.url());

  // === 2. Login ===
  await login(page, 'Andi Pratama');
  check('Wajib #1: login -> dashboard', page.url() === BASE + '/', page.url());

  // === 3. Dashboard render ===
  const t1 = await page.evaluate(() => document.body.innerText);
  check('Wajib #2: tombol "+ Chat baru"', t1.includes('Chat baru'));
  check('Bukan form login lagi', !t1.includes('Daftar akun baru'));
  check('Wajib #1: nama user tampil', t1.includes('Andi Pratama'));

  // Wajib #6: search box (placeholder attr, bukan innerText)
  const hasSearch = await page.evaluate(() => !!document.querySelector('input[placeholder="Cari chat"]'));
  check('Wajib #6: search box "Cari chat"', hasSearch);
  await wait(2500);
  const peers = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll('h3')).map((e) => e.innerText?.trim());
    return [...new Set(names)].filter(Boolean);
  });
  check('Wajib #4: daftar chat dari DB', peers.length > 0, `${peers.length}: ${peers.join(', ')}`);

  // === 5. Buka percakapan + kirim pesan (Wajib #3) ===
  if (peers.length > 0) {
    const peer = peers[0];
    // Klik h3 nama lawan bicara; event bubble ke div onClick
    const opened = await page.evaluate((name) => {
      const h3 = Array.from(document.querySelectorAll('h3')).find((e) => e.innerText?.trim() === name);
      if (!h3) return false;
      h3.click();
      return true;
    }, peer);
    check('Wajib #3: percakapan terbuka', opened, peer);
    await wait(3000);

    const input = await page.$('input[placeholder="Tulis pesan..."]');
    check('Wajib #3: input pesan ada', !!input);

    if (input) {
      const uniq = 'Halo dari e2e ' + Date.now();
      // Controlled input React: pakai native setter + input event
      // (keyboard.type saja tidak memicu onChange React)
      await page.evaluate((sel, val) => {
        const el = document.querySelector(sel);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, 'input[placeholder="Tulis pesan..."]', uniq);
      await wait(600);
      // Submit via Enter
      await input.focus();
      await page.keyboard.press('Enter');
      await wait(3500);
      const t3 = await page.evaluate(() => document.body.innerText);
      check('Wajib #3: pesan terkirim & tampil', t3.includes(uniq));

      // Persist setelah reload (Wajib #3)
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await wait(3500);
      const t4 = await page.evaluate(() => document.body.innerText);
      check('Wajib #3: pesan persist setelah reload', t4.includes(uniq));
    }
  }

  // === 6. Dark mode (Wajib #6) ===
  const before = await page.evaluate(() => document.documentElement.className);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button'))
      .find((x) => /Light Mode|Dark Mode/.test(x.getAttribute('aria-label') || ''));
    b?.click();
  });
  await wait(1500);
  const after = await page.evaluate(() => document.documentElement.className);
  check('Wajib #6: toggle light/dark', before !== after, `${before.includes('dark') ? 'dark' : 'light'} -> ${after.includes('dark') ? 'dark' : 'light'}`);

  // === 7. Logout (Wajib #1) ===
  // Logout ada di dalam dropdown menu user — buka dulu, baru klik.
  await page.evaluate(() => {
    // User menu = button berisi nama/inisial user sendiri (Andi Pratama / AP)
    const btns = Array.from(document.querySelectorAll('button'));
    const userBtn = btns.find((b) => /Andi Pratama|^AP$|\bAP\b/.test(b.innerText || ''));
    userBtn?.click();
  });
  await wait(1200);
  const logoutClicked = await page.evaluate(() => {
    const out = document.evaluate(
      "//*[text()='Keluar (Logout)']",
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    if (out) { out.closest('button')?.click() || out.click(); return true; }
    return false;
  });
  check('Wajib #1: tombol logout diklik', logoutClicked);
  await wait(4000);
  check('Wajib #1: logout -> /login', page.url().includes('/login'), page.url());

  // === 8. Guard setelah logout ===
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 20000 });
  check('Wajib #1: guard aktif setelah logout', page.url().includes('/login'), page.url());

  // === 9. Isolasi data (Wajib #5) ===
  // Context terpisah = cookie terpisah (Rina tidak mewarisi sesi Andi)
  const ctx2 = await browser.createBrowserContext();
  const p2 = await ctx2.newPage();
  await p2.setViewport({ width: 1280, height: 800 });
  await login(p2, 'Rina Kartika');
  check('Wajib #5: Rina login ke dashboard', p2.url() === BASE + '/', p2.url());

  const rinaPeers = await p2.evaluate(() => {
    const names = Array.from(document.querySelectorAll('h3')).map((e) => e.innerText?.trim());
    return [...new Set(names)].filter(Boolean);
  });
  const otherPeers = ['Sari Wulandari', 'Bayu Nugroho', 'Maya Handayani', 'Yoga Aditya', 'Tim Support'];
  const leaked = otherPeers.filter((n) => rinaPeers.includes(n));
  check('Wajib #5: Rina hanya lihat Andi+Dimas', leaked.length === 0 && rinaPeers.includes('Andi Pratama'), 'h3: ' + rinaPeers.join(', '));

  // API langsung ke percakapan bukan miliknya
  const s1 = await p2.evaluate(async () => {
    const r = await fetch('/api/conversations/conv-andi-bayu/messages', { credentials: 'same-origin' });
    return r.status;
  });
  check('Wajib #5: API 403 untuk bukan peserta', s1 === 403, 'HTTP ' + s1);

  // Kirim pesan ke percakapan bukan miliknya
  const s2 = await p2.evaluate(async () => {
    const r = await fetch('/api/conversations/conv-andi-bayu/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ text: 'injeksi' }),
    });
    return r.status;
  });
  check('Wajib #5: API 403 kirim ke percakapan lain', s2 === 403, 'HTTP ' + s2);

  // Tanpa session
  const s3 = await p2.evaluate(async () => {
    const r = await fetch('/api/conversations', { credentials: 'omit' });
    return r.status;
  });
  check('Wajib #5: tanpa session 401', s3 === 401, 'HTTP ' + s3);

  await browser.close();
  log.push('');
  log.push(`=== ${pass} PASS / ${fail} FAIL ===`);
  console.log(log.join('\n'));
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL: ' + e.message);
  process.exit(1);
});
