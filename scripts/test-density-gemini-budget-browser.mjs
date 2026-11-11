import assert from 'node:assert/strict';
import {createPersonalServer} from './serve-personal-figureforge.mjs';

const {chromium}=await import('../_local/test/node_modules/playwright-core/index.mjs');
let imageBase64='',alwaysOver=false;
const counts=[],images=[];
const server=createPersonalServer({fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body.toString());
  if(url.endsWith(':countTokens')){
    counts.push(body);
    const longStyle=body.contents[0].parts[0].text.includes('Required canvas aspect ratio');
    return new Response(JSON.stringify({totalTokens:alwaysOver||longStyle?65000:59000}),{headers:{'Content-Type':'application/json'}});
  }
  images.push(body);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:imageBase64}}]}}]}),{headers:{'Content-Type':'application/json'}});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({serviceWorkers:'block'});
try{
  await page.goto(origin+'/forge/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#privateRefStatus')?.textContent.includes('42'));
  imageBase64=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    canvas.getContext('2d').fillRect(0,0,1280,720);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#provider').selectOption('oai');
  await page.locator('#key').fill('fake-openai-key');
  await page.locator('#modeTabs button[data-mode="image"]').click();
  await page.locator('#imageProvider').selectOption('gemini');
  await page.locator('#geminiKey').fill('fake-gemini-key');
  await page.locator('#model').selectOption('gemini-3-pro-image');
  await page.locator('#imageResolution').selectOption('1K');
  await page.locator('#passTabs button[data-pass="direct"]').click();
  await page.locator('#paper').fill('Component A sends data to component B, which produces result C.');
  await page.locator('#genBtn').click();
  await page.waitForSelector('#out img[data-step3-output="true"]',{timeout:15000});
  assert.equal(counts.length,2,'long style then compact style must both be counted');
  assert.equal(images.length,1);
  assert.match(images[0].contents[0].parts[0].text,/Component A sends data/);
  assert.match(await page.locator('#imageBudgetStatus').textContent(),/59,000.*repeated style guidance condensed/);
  alwaysOver=true;
  await page.locator('#genBtn').click();
  await page.waitForFunction(()=>document.querySelector('#genErr')?.textContent.includes('60,000-token ceiling'),{timeout:15000});
  assert.equal(images.length,1,'an oversized request must not reach image generation');
  console.log('PASS browser: Gemini counts all input, condenses style, blocks oversized requests');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
