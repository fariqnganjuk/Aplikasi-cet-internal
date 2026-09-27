const puppeteer = require('puppeteer-core');
const fs = require('fs');
const out = process.env.TEMP + '/opencode/shots2';
fs.mkdirSync(out, {recursive:true});
const wait = (ms) => new Promise(r=>setTimeout(r,ms));

(async()=>{
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox','--hide-scrollbars','--force-color-profile=srgb']
  });

  const page = await browser.newPage();
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});

  // 1. Login page - light mode (fresh profile, no localStorage)
  await page.goto('http://localhost:3000/login',{waitUntil:'networkidle0'});
  await wait(2500);
  await page.screenshot({path: out+'/01-login-light.png'});
  console.log('01-login-light OK');

  // 2. Login as Andi
  await page.click('input[type=email]');
  await page.type('input[type=email]','andi@contoh.id',{delay:15});
  await page.click('input[type=password]');
  await page.type('input[type=password]','password123',{delay:15});
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForNavigation({waitUntil:'networkidle0',timeout:15000}).catch(()=>{})
  ]);
  await wait(3500);
  await page.screenshot({path: out+'/02-chat-list.png'});
  console.log('02-chat-list OK');

  // 3. Open first conversation
  const rows = await page.$$('aside .cursor-pointer');
  if(rows.length>0){ await rows[0].click(); await wait(2500); }
  await page.screenshot({path: out+'/03-conversation.png'});
  console.log('03-conversation OK (rows='+rows.length+')');

  // 4. Dark mode
  const tgl = await page.$('button[aria-label*="Dark"], button[aria-label*="Light"]');
  if(tgl){ await tgl.click(); await wait(2000); }
  await page.screenshot({path: out+'/04-conversation-dark.png'});
  console.log('04-dark OK');

  // 5. Empty state (new chat modal)
  const plus = await page.$$eval('button', bs => {
    const b = bs.find(x => x.textContent && x.textContent.includes('Chat baru'));
    return b ? 1 : 0;
  });
  if(plus){
    await page.$$eval('button', bs => {
      const b = bs.find(x => x.textContent && x.textContent.includes('Chat baru'));
      if(b) b.click();
    });
    await wait(2500);
    await page.screenshot({path: out+'/05-new-chat.png'});
    console.log('05-new-chat OK');
  }

  // 6. Mobile view
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await wait(1500);
  await page.screenshot({path: out+'/06-mobile.png'});
  console.log('06-mobile OK');

  await browser.close();
  console.log('DONE -> '+out);
})().catch(e=>{console.error(e.message);process.exit(1);});