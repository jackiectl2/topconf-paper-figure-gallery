import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPersonalServer} from './serve-personal-figureforge.mjs';

const {chromium}=await import('../_local/test/node_modules/playwright-core/index.mjs');
const folder=mkdtempSync(join(tmpdir(),'figureforge-picker-browser-'));
const keyFile=join(folder,'ai_keys.env');
const sharedKeyFile=join(folder,'.ai_keys.env');
writeFileSync(sharedKeyFile,'export OPENAI_API_KEY="mock-openai-only"\nexport GOOGLE_API_KEY="mock-gemini-only"\n',{mode:0o600});
let imageBase64='';
const geminiCalls=[],analysisCalls=[],errors=[],consoleMessages=[];
const server=createPersonalServer({keyFile,sharedKeyFile,ocrImpl:async()=>({characters:123}),fetchImpl:async(url,init)=>{
  geminiCalls.push({url,headers:init.headers,body:JSON.parse(init.body.toString())});
  if(url.endsWith(':countTokens'))return new Response(JSON.stringify({totalTokens:2100}),{status:200,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:imageBase64}}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({serviceWorkers:'block'});
function zipEntry(zip,name){
  for(let pos=0;pos<zip.length-30;){
    if(zip.readUInt32LE(pos)!==0x04034b50)break;
    const size=zip.readUInt32LE(pos+18),nameSize=zip.readUInt16LE(pos+26),extraSize=zip.readUInt16LE(pos+28);
    const entryName=zip.subarray(pos+30,pos+30+nameSize).toString();
    const start=pos+30+nameSize+extraSize;
    if(entryName===name)return zip.subarray(start,start+size);
    pos=start+size;
  }
  throw new Error('Missing ZIP entry: '+name);
}
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>consoleMessages.push(message.text()));
try{
  await page.route('https://api.openai.com/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/models'))return route.fulfill({json:{data:[{id:'gpt-6.1-sol'}]}});
    if(url.pathname.endsWith('/chat/completions')){
      const body=route.request().postDataJSON();
      analysisCalls.push({authorization:route.request().headers().authorization,body});
      const selected=await page.evaluate(()=>[...document.querySelectorAll('#refsStrip .refmini span')].map(x=>x.textContent.match(/(?:ref|test)_\d+/)?.[0]).filter(Boolean));
      const answer={representative:selected.slice(0,4),imageRefIds:selected.slice(0,3),refinedPrompt:'Square panels and straight arrows',layout:'two panels',elements:'icons and arrows',hierarchy:'left to right'};
      return route.fulfill({json:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]}});
    }
    return route.fulfill({status:404,json:{error:{message:'mock unavailable'}}});
  });
  await page.goto(origin+'/forge/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#privateRefStatus')?.textContent.includes('42'));
  imageBase64=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1280,720);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#provider').selectOption('oai');
  await page.waitForFunction(()=>document.querySelector('#key')?.value==='mock-openai-only');
  assert.equal(await page.locator('#keySource').inputValue(),'default');
  assert.equal(await page.locator('#key').isEditable(),false);
  await page.locator('#modeTabs button[data-mode="image"]').click();
  await page.locator('#imageProvider').selectOption('gemini');
  await page.waitForFunction(()=>document.querySelector('#geminiKey')?.value==='mock-gemini-only');
  assert.equal(await page.locator('#geminiKeySource').inputValue(),'default');
  await page.locator('#imageResolution').selectOption('1K');
  await page.locator('#paper').fill('Input goes through an encoder and decoder to produce a method output.');

  await page.locator('#privateRefCount').selectOption('1');
  await page.locator('#refsPickPrivateBtn').click();
  assert.equal(await page.locator('#privatePickerGrid button').count(),42);
  await page.locator('#privatePickerType').selectOption('ref');
  assert.ok((await page.locator('#privatePickerGrid button').count())>0);
  await page.locator('#privatePickerType').selectOption('all');
  const first=page.locator('#privatePickerGrid button').first();
  const secondId=await page.locator('#privatePickerGrid button').nth(1).getAttribute('data-id');
  await first.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.id),secondId);
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#privatePickerConfirm').isEnabled(),true);
  await page.locator('#privatePickerCancel').click();
  assert.equal(await page.locator('#refsStrip .refmini').count(),0,'Cancel must not change references');
  await page.locator('#refsPickPrivateBtn').click();
  await page.locator('#privatePickerGrid button').nth(1).click();
  await page.locator('#privatePickerConfirm').click();
  assert.equal(await page.locator('#refsStrip .refmini').count(),1);
  await page.locator('#genBtn').click();
  await page.waitForFunction(()=>document.querySelector('#out img[data-step3-output="true"]')&&!document.querySelector('#genBtn').disabled,{timeout:45000});
  assert.equal(analysisCalls.length,1);
  assert.equal(analysisCalls[0].authorization,'Bearer mock-openai-only');
  assert.equal(analysisCalls[0].body.messages[1].content.filter(x=>x.type==='image_url').length,1);
  assert.equal(geminiCalls.find(x=>x.url.endsWith(':generateContent')).body.contents[0].parts.filter(x=>x.inlineData).length,1);
  assert.equal(geminiCalls.find(x=>x.url.endsWith(':generateContent')).headers['x-goog-api-key'],'mock-gemini-only');
  assert.equal(await page.locator('#refsStrip .refmini').count(),1,'Generate must keep manual picks');

  await page.locator('#refsPickPrivateBtn').click();
  await page.locator('#privatePickerGrid button').nth(1).click();
  await page.locator('#privatePickerCancel').click();
  assert.equal(await page.locator('#refsStrip .refmini').count(),1,'Cancel must preserve confirmed picks');
  await page.locator('#refsAutoBtn').click();
  await page.locator('#privateRefCount').selectOption('4');
  await page.locator('#refsPickPrivateBtn').click();
  for(let i=0;i<4;i++)await page.locator('#privatePickerGrid button').nth(i).click();
  assert.equal(await page.locator('#privatePickerConfirm').isEnabled(),true);
  await page.locator('#privatePickerConfirm').click();
  const chosen=await page.locator('#refsStrip .refmini span').allTextContents();
  await page.locator('#genBtn').click();
  await page.waitForFunction(()=>document.querySelector('#out img[data-step3-output="true"]')&&!document.querySelector('#genBtn').disabled,{timeout:45000});
  assert.equal(analysisCalls[1].body.messages[1].content.filter(x=>x.type==='image_url').length,4);
  assert.equal(geminiCalls.filter(x=>x.url.endsWith(':generateContent'))[1].body.contents[0].parts.filter(x=>x.inlineData).length,3);
  assert.equal(await page.locator('#sentRefsPreview img').count(),3);
  for(const label of chosen)assert.match(await page.locator('#sentRefsSummary').textContent(),new RegExp(label.match(/(?:ref|test)_\d+/)?.[0]));
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#dlImg').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/^figure-forge-[\w-]+-draft\.zip$/);
  const zip=readFileSync(await download.path());
  const record=JSON.parse(zipEntry(zip,'references.json').toString());
  assert.equal(record.outputKind,'step3-bitmap');
  assert.equal(record.selectedReferenceIds.length,4);
  assert.equal(record.analysisReferenceIds.length,4);
  assert.equal(record.generationReferenceIds.length,3);
  assert.equal(record.draftId.length,36);
  assert.ok(zipEntry(zip,record.outputFile).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#key')?.value==='mock-openai-only');
  await page.locator('#modeTabs button[data-mode="image"]').click();
  await page.locator('#imageProvider').selectOption('gemini');
  await page.waitForFunction(()=>document.querySelector('#geminiKey')?.value==='mock-gemini-only');
  const stored=await page.evaluate(()=>Object.entries(localStorage));
  assert.ok(stored.every(([key,value])=>!value.includes('mock-openai-only')&&!value.includes('mock-gemini-only')));
  assert.deepEqual(errors,[]);
  assert.ok(consoleMessages.every(message=>!message.includes('mock-openai-only')&&!message.includes('mock-gemini-only')));
  rmSync(sharedKeyFile);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#keySourceStatus')?.textContent.includes('unavailable'));
  assert.equal(await page.locator('#key').inputValue(),'');
  await page.locator('#keySource').selectOption('manual');
  assert.equal(await page.locator('#key').isEditable(),true);
  process.stdout.write('PASS browser: private picker, 1/4 reference routing, local default keys and missing-key recovery\n');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
  rmSync(folder,{recursive:true,force:true});
}
