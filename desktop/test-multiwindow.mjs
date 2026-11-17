import assert from 'node:assert/strict';
import {copyFileSync,existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const {_electron}=await import('playwright-core');
function zipEntry(zip,name){
  for(let position=0;position<zip.length-30;){
    if(zip.readUInt32LE(position)!==0x04034b50)break;
    const size=zip.readUInt32LE(position+18),nameSize=zip.readUInt16LE(position+26),extraSize=zip.readUInt16LE(position+28);
    const entryName=zip.subarray(position+30,position+30+nameSize).toString();
    const start=position+30+nameSize+extraSize;
    if(entryName===name)return zip.subarray(start,start+size);
    position=start+size;
  }
  throw new Error('Missing ZIP entry: '+name);
}
const testRoot=mkdtempSync(join(tmpdir(),'figureforge-multiwindow-'));
const privateRoot=join(testRoot,'paperbananabench');
mkdirSync(join(privateRoot,'images'),{recursive:true});
const figures=Array.from({length:42},(_,index)=>({id:`ref_${index+1}`,image:`images/ref_${index+1}.jpg`}));
const publicImage=join(projectRoot,'images/acl/final/acl2024-2024.acl-long.238.jpg');
for(const figure of figures)copyFileSync(publicImage,join(privateRoot,figure.image));
writeFileSync(join(privateRoot,'manifest.json'),JSON.stringify({figures}));
writeFileSync(join(privateRoot,'default-selection.json'),JSON.stringify({ids:figures.slice(0,10).map(figure=>figure.id)}));

let electron;
let electronProcess;
try{
  electron=await _electron.launch({
    executablePath:join(projectRoot,'desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
    args:[join(projectRoot,'desktop')],
    env:{...process.env,FIGUREFORGE_TEST_USER_DATA:testRoot,FIGUREFORGE_TEST_NO_DEVTOOLS:'1'},
    timeout:20000
  });
  electronProcess=electron.process();
  const first=await electron.firstWindow({timeout:20000});
  await first.locator('#paper').waitFor();
  await first.locator('#privateRefStatus').waitFor({state:'visible'});
  await first.waitForFunction(()=>document.title.includes('Experiment 1'));
  assert.equal(await first.locator('#key').inputValue(),'','test windows must not read the user’s home key file');
  assert.equal(await first.locator('#geminiKey').inputValue(),'','test windows must not read the user’s home key file');
  assert.equal(await electron.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('new-experiment').accelerator),'CommandOrControl+N');
  assert.equal(await electron.evaluate(({Menu})=>Menu.getApplicationMenu().getMenuItemById('duplicate-paper').accelerator),'CommandOrControl+Shift+N');
  assert.match(await first.title(),/Experiment 1/);
  assert.equal(await first.locator('#refsStrip .refmini').count(),10);
  await first.locator('#paper').fill('This paper has an encoder, memory and decoder.');
  await first.locator('#target').selectOption('architecture');
  await first.evaluate(()=>localStorage.setItem('figureforge-isolation-test','first'));
  await first.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('figureforge-isolation-test',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('marker');
    request.onsuccess=()=>{request.result.close();resolve();};
    request.onerror=()=>reject(request.error);
  }));

  const secondPromise=electron.waitForEvent('window',{timeout:15000});
  await electron.evaluate(({Menu})=>{Menu.getApplicationMenu().getMenuItemById('new-experiment').click();});
  const second=await secondPromise;
  await second.locator('#paper').waitFor();
  await second.waitForLoadState('domcontentloaded');
  await second.waitForFunction(()=>document.title.includes('Experiment 2'));
  assert.match(await second.title(),/Experiment 2/);
  assert.equal(await second.locator('#paper').inputValue(),'');
  assert.equal(await second.locator('#refsStrip .refmini').count(),10);
  assert.equal(await second.evaluate(()=>localStorage.getItem('figureforge-isolation-test')),null);
  assert.equal(await second.evaluate(async()=>
    (await indexedDB.databases()).some(database=>database.name==='figureforge-isolation-test')),false);
  await second.locator('#paper').fill('A different paper used in experiment two.');
  assert.match(await first.locator('#paper').inputValue(),/encoder, memory and decoder/);

  const focusedTitle=await electron.evaluate(({BrowserWindow})=>{
    const source=BrowserWindow.getAllWindows().find(window=>window.getTitle().includes('Experiment 1'));
    source.focus();
    return BrowserWindow.getFocusedWindow()?.getTitle();
  });
  assert.match(focusedTitle,/Experiment 1/);
  const thirdPromise=electron.waitForEvent('window',{timeout:15000});
  await electron.evaluate(({Menu})=>{Menu.getApplicationMenu().getMenuItemById('duplicate-paper').click();});
  const third=await thirdPromise;
  await third.locator('#paper').waitFor();
  await third.waitForFunction(()=>document.title.includes('Experiment 3'));
  assert.match(await third.title(),/Experiment 3/);
  assert.equal(await third.locator('#paper').inputValue(),await first.locator('#paper').inputValue());
  assert.equal(await third.locator('#target').inputValue(),'architecture');
  assert.equal(await third.evaluate(()=>localStorage.getItem('figureforge-isolation-test')),null);
  await third.locator('#paper').fill('Experiment three has its own revision.');
  assert.match(await first.locator('#paper').inputValue(),/encoder, memory and decoder/);
  assert.match(await second.locator('#paper').inputValue(),/experiment two/);
  await third.close();
  assert.equal(electron.windows().length,2,'closing one experiment keeps the others open');

  // Compare two reference sets against the same paper. Hold the mock image
  // responses until both windows reach generation, proving real concurrency.
  await second.locator('#paper').fill(await first.locator('#paper').inputValue());
  await second.locator('#target').selectOption('architecture');
  await second.locator('#refsPickPrivateBtn').click();
  for(let index=1;index<=10;index++)await second.locator(`#privatePickerGrid button[data-id="ref_${index}"]`).click();
  for(let index=11;index<=20;index++)await second.locator(`#privatePickerGrid button[data-id="ref_${index}"]`).click();
  await second.locator('#privatePickerConfirm').click();
  assert.deepEqual(await second.locator('#refsStrip .x').evaluateAll(buttons=>buttons.map(button=>button.dataset.id)),figures.slice(10,20).map(figure=>figure.id));
  const imageBase64=await first.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,1280,720);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const analysisRequests=[],imageRequests=[];
  let releaseImages;
  const bothImagesStarted=new Promise(resolve=>{releaseImages=resolve;});
  for(const [name,page] of [['first',first],['second',second]]){
    await page.route('https://api.openai.com/**',async route=>{
      if(route.request().url().endsWith('/models')){
        await route.fulfill({json:{data:[{id:'gpt-6.1-sol'}]}});return;
      }
      const ids=await page.locator('#refsStrip .x').evaluateAll(buttons=>buttons.map(button=>button.dataset.id));
      const body=route.request().postDataJSON();
      analysisRequests.push({name,ids,imageCount:body.messages?.[1]?.content?.filter(part=>part.type==='image_url').length});
      const answer={representative:ids.slice(0,4),imageRefIds:ids.slice(0,3),refinedPrompt:'Square panels and straight arrows',layout:'two panels',elements:'icons and arrows',hierarchy:'left to right'};
      await route.fulfill({json:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]}});
    });
    await page.route('**/api/gemini-count',route=>route.fulfill({json:{totalTokens:2400}}));
    await page.route('**/api/figure-text-count',route=>route.fulfill({json:{characters:12}}));
    await page.route('**/api/gemini-image',async route=>{
      imageRequests.push({name,body:route.request().postDataJSON()});
      if(imageRequests.length===2)releaseImages();
      await bothImagesStarted;
      await route.fulfill({json:{candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:imageBase64}}]}}]}});
    });
    await page.locator('#provider').selectOption('oai');
    await page.locator('#keySource').selectOption('manual');
    await page.locator('#key').fill('mock-openai-key');
    await page.locator('#geminiKeySource').selectOption('manual');
    await page.locator('#geminiKey').fill('mock-gemini-key');
    await page.locator('#imageResolution').selectOption('1K');
  }
  await Promise.all([first.locator('#genBtn').click(),second.locator('#genBtn').click()]);
  await Promise.all([first.locator('#out img[data-step3-output="true"]').waitFor({timeout:45000}),second.locator('#out img[data-step3-output="true"]').waitFor({timeout:45000})]);
  assert.equal(analysisRequests.length,2);
  assert.ok(analysisRequests.every(request=>request.imageCount===10));
  assert.deepEqual(new Set(analysisRequests.map(request=>request.name)),new Set(['first','second']));
  assert.equal(imageRequests.length,2,'both image requests start before either mock response is released');
  assert.deepEqual(new Set(imageRequests.map(request=>request.name)),new Set(['first','second']));
  for(const request of imageRequests){
    assert.equal(request.body.contents[0].parts.filter(part=>part.inlineData).length,3);
    assert.match(JSON.stringify(request.body),/This paper has an encoder, memory and decoder/);
  }
  assert.match(await first.locator('#sentRefsSummary').textContent(),/ref_1/);
  assert.match(await second.locator('#sentRefsSummary').textContent(),/ref_11/);
  await electron.evaluate(({BrowserWindow},directory)=>{
    globalThis.__ffTestDownloads=[];
    for(const window of BrowserWindow.getAllWindows()){
      if(!/Experiment [12]$/.test(window.getTitle()))continue;
      window.webContents.session.on('will-download',(_event,item)=>{
        const destination=directory+'/'+window.getTitle().replace(/\W+/g,'-')+'-'+item.getFilename();
        item.setSavePath(destination);
        const record={window:window.getTitle(),path:destination,state:'running'};
        globalThis.__ffTestDownloads.push(record);
        item.on('done',(_event,state)=>{record.state=state;});
      });
    }
  },testRoot);
  await Promise.all([first.locator('#dlImg').click(),second.locator('#dlImg').click()]);
  let saved=[];
  for(let attempt=0;attempt<100;attempt++){
    saved=await electron.evaluate(()=>globalThis.__ffTestDownloads||[]);
    if(saved.length===2&&saved.every(item=>item.state==='completed'))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(saved.length,2,'both windows must start separate downloads');
  assert.ok(saved.every(item=>item.state==='completed'&&existsSync(item.path)),'both downloads must finish');
  assert.notEqual(saved[0].path,saved[1].path);
  const firstRecord=JSON.parse(zipEntry(readFileSync(saved.find(item=>item.window.endsWith('Experiment 1')).path),'references.json').toString());
  const secondRecord=JSON.parse(zipEntry(readFileSync(saved.find(item=>item.window.endsWith('Experiment 2')).path),'references.json').toString());
  assert.deepEqual(firstRecord.analysisReferenceIds,figures.slice(0,10).map(figure=>figure.id));
  assert.deepEqual(secondRecord.analysisReferenceIds,figures.slice(10,20).map(figure=>figure.id));
  assert.deepEqual(firstRecord.generationReferenceIds,figures.slice(0,3).map(figure=>figure.id));
  assert.deepEqual(secondRecord.generationReferenceIds,figures.slice(10,13).map(figure=>figure.id));
  console.log('PASS Electron: three isolated windows, copied paper, simultaneous mocked generations, and separate download provenance');
}finally{
  if(electron){
    for(const page of electron.windows().reverse())await page.close().catch(()=>{});
    const closed=await Promise.race([electron.close().then(()=>true).catch(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),5000))]);
    if(!closed&&electronProcess?.exitCode===null)electronProcess.kill('SIGKILL');
  }
  rmSync(testRoot,{recursive:true,force:true});
}
