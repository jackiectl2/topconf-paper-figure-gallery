import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPersonalServer} from './serve-personal-figureforge.mjs';

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

const {chromium}=await import('../_local/test/node_modules/playwright-core/index.mjs');
let imageBase64='';
let geminiStatus=200;
let svgDraft=false;
const geminiCalls=[];
const geminiCounts=[];
const server=createPersonalServer({ocrImpl:async()=>({characters:20}),fetchImpl:async(url,init)=>{
  if(url.endsWith(':countTokens')){
    geminiCounts.push({url,headers:init.headers,body:JSON.parse(init.body.toString())});
    return new Response(JSON.stringify({totalTokens:2400}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  geminiCalls.push({url,headers:init.headers,body:JSON.parse(init.body.toString())});
  return new Response(JSON.stringify(geminiStatus===200?{candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:imageBase64}}]}}]}:{error:{message:'Mock provider rejected the request'}}),{status:geminiStatus,headers:{'Content-Type':'application/json'}});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({serviceWorkers:'block'});
const errors=[],chatBodies=[],consoleMessages=[],openAIImages=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>consoleMessages.push(message.text()));
try{
  await page.route(origin+'/forge/',async route=>{
    const response=await route.fetch();
    let html=await response.text();
    html=html.replace('\nawait boot();','\nwindow.__selectedRefs=()=>[...refs];window.__normalizeRequest=(body,scope)=>withReasoning(body,scope);\nawait boot();');
    await route.fulfill({response,body:html});
  });
  await page.route('https://api.openai.com/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/models')) return route.fulfill({json:{data:[{id:'gpt-6.1-sol'},{id:'gpt-image-2.5-sunburst'}]}});
    if(url.pathname.endsWith('/chat/completions')){
      const body=route.request().postDataJSON();chatBodies.push(body);
      if(svgDraft) return route.fulfill({json:{choices:[{finish_reason:'stop',message:{content:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect id="background" data-role="background" data-editable="true" x="0" y="0" width="1600" height="900" fill="#ffffff"/><text id="title" data-role="label" data-editable="true" x="80" y="80" font-size="32">Demo</text></svg>'}}]}});
      const ids=await page.evaluate(()=>window.__selectedRefs());
      const answer={representative:ids.slice(0,4),imageRefIds:ids.slice(0,3),refinedPrompt:'Dense panels and arrows',layout:'three panels',elements:'arrows',hierarchy:'left to right'};
      return route.fulfill({json:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]}});
    }
    if(url.pathname.endsWith('/images/edits')||url.pathname.endsWith('/images/generations')){
      openAIImages.push({url:url.pathname,authorization:route.request().headers().authorization,contentType:route.request().headers()['content-type'],body:route.request().postData()});
      return route.fulfill({json:{data:[{b64_json:imageBase64}]}});
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
  await page.locator('#keySource').selectOption('manual');
  await page.locator('#key').fill('mock-openai-key');
  const normalized=await page.evaluate(()=>['parse','visual','recon'].map(scope=>window.__normalizeRequest({model:'gpt-6.1-sol',max_tokens:5000,temperature:0.1,messages:[]},scope)));
  for(const body of normalized){assert.equal(body.max_completion_tokens,5000);assert.equal('max_tokens' in body,false);assert.equal('temperature' in body,false);}
  const unsupported=await page.evaluate(()=>{
    document.querySelector('#visualReasoningEffort').value='high';
    try{window.__normalizeRequest({model:'gpt-4o',max_tokens:5000,messages:[]},'visual');return false;}
    catch{return true;}
    finally{document.querySelector('#visualReasoningEffort').value='';}
  });
  assert.equal(unsupported,true);
  await page.locator('#modeTabs button[data-mode="image"]').click();
  await page.locator('#imageProvider').selectOption('gemini');
  await page.locator('#geminiKeySource').selectOption('manual');
  await page.locator('#geminiKey').fill('mock-gemini-key');
  await page.locator('#imageResolution').selectOption('1K');
  await page.locator('#paper').fill('A method with input, encoder, memory, decoder and evaluation stages.');
  assert.equal(await page.locator('#model').inputValue(),'gemini-3.1-flash-image');
  assert.equal(await page.locator('#analyzeModel').inputValue(),'gpt-6.1-sol');
  await page.locator('#genBtn').click();
  await page.waitForSelector('#out img[data-step3-output="true"]',{timeout:45000});
  await page.waitForFunction(()=>!document.querySelector('#genBtn').disabled);
  assert.equal(await page.evaluate(()=>window.__ffExportState.reviewPending),true);
  assert.equal(await page.evaluate(()=>window.__ffExportState.reconPending),false);
  assert.equal(await page.locator('#exportConfirm').isDisabled(),true);
  assert.equal(chatBodies.length,1,'bitmap preview must not start reconstruction');
  await page.locator('#continueToStep4').click();
  assert.equal(await page.evaluate(()=>window.__ffExportState.reviewPending),false);
  assert.equal(await page.locator('#reconBtn').isEnabled(),true);
  assert.equal(chatBodies.length,1,'entering Step 4 must wait for manual reconstruction');
  const selected=await page.evaluate(()=>window.__selectedRefs());
  assert.equal(selected.length,4);
  assert.equal(new Set(selected).size,4);
  assert.equal(await page.locator('#refsStrip .refmini img').count(),4);
  assert.equal(chatBodies[0].model,'gpt-6.1-sol');
  assert.equal(chatBodies[0].max_completion_tokens,16000);
  assert.equal('max_tokens' in chatBodies[0],false);
  assert.equal('temperature' in chatBodies[0],false);
  assert.equal(chatBodies[0].messages[1].content.filter(x=>x.type==='image_url').length,4);
  assert.equal(geminiCalls.length,1);
  assert.equal(geminiCounts.length,1);
  assert.deepEqual(geminiCounts[0].body.contents,geminiCalls[0].body.contents);
  assert.equal(geminiCalls[0].headers['x-goog-api-key'],'mock-gemini-key');
  assert.equal('Authorization' in geminiCalls[0].headers,false);
  assert.equal(geminiCalls[0].body.contents[0].parts.filter(x=>x.inlineData).length,3);
  assert.match(JSON.stringify(geminiCalls[0].body),/Comic Sans MS/);
  assert.match(JSON.stringify(geminiCalls[0].body),/every visible word in the finished figure must be English/);
  assert.match(JSON.stringify(geminiCalls[0].body),/Do not add any figure-wide title banner or standalone title row/);
  assert.match(JSON.stringify(geminiCalls[0].body),/restrained cartoon illustration style/);
  const disclosure=await page.locator('#sentRefsSummary').textContent();
  for(const id of selected) assert.ok(disclosure.includes(id));
  assert.equal(await page.locator('#sentRefsPreview img').count(),3);
  const stored=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.includes('key')));
  assert.deepEqual(stored,[]);
  assert.deepEqual(errors,[]);
  assert.ok(consoleMessages.every(message=>!message.includes('mock-openai-key')&&!message.includes('mock-gemini-key')));
  await page.waitForFunction(()=>!document.querySelector('#genBtn').disabled);
  await page.locator('#imageProvider').selectOption('step1');
  const paperBeforeRegenerate=await page.locator('#paper').inputValue();
  await page.locator('#regenerateDraft').click();
  await page.waitForFunction(()=>document.querySelector('#out img[data-step3-output="true"]') && !document.querySelector('#genBtn').disabled,{timeout:45000});
  assert.equal(await page.locator('#paper').inputValue(),paperBeforeRegenerate);
  assert.equal(chatBodies.length,2,'regeneration repeats reference analysis without reparsing the paper');
  const second=await page.evaluate(()=>window.__selectedRefs());
  assert.equal(second.length,4);
  assert.equal(new Set([...selected,...second]).size,8);
  assert.equal(openAIImages.length,1);
  assert.equal(openAIImages[0].authorization,'Bearer mock-openai-key');
  assert.match(openAIImages[0].contentType,/multipart\/form-data/);
  assert.ok(!openAIImages[0].body.includes('mock-gemini-key'));
  assert.match(openAIImages[0].body,/Comic Sans MS/);
  assert.match(openAIImages[0].body,/every visible word in the finished figure must be English/);
  assert.match(openAIImages[0].body,/Do not add any figure-wide title banner or standalone title row/);
  assert.match(openAIImages[0].body,/restrained cartoon illustration style/);
  assert.equal(geminiCalls.length,1);
  await page.locator('#imageProvider').selectOption('gemini');
  await page.locator('#geminiKey').fill('');
  await page.locator('#genBtn').click();
  assert.match(await page.locator('#genErr').textContent(),/Gemini API Key/);
  assert.equal(geminiCalls.length,1);
  await page.locator('#geminiKey').fill('mock-gemini-key');
  geminiStatus=401;
  await page.locator('#genBtn').click();
  await page.waitForFunction(()=>document.querySelector('#genErr')?.textContent.includes('HTTP 401'));
  assert.equal(geminiCalls.length,2);
  assert.ok(!(await page.locator('#genErr').textContent()).includes('mock-gemini-key'));
  geminiStatus=200;
  await page.locator('#passTabs button[data-pass="direct"]').click();
  await page.locator('#privateRefCount').selectOption('10');
  await page.locator('#model').selectOption('gemini-3-pro-image');
  await page.locator('#genBtn').click();
  await page.waitForFunction(()=>document.querySelector('#out img[data-step3-output="true"]') && !document.querySelector('#genBtn').disabled);
  assert.equal((await page.evaluate(()=>window.__selectedRefs())).length,10);
  assert.equal(geminiCalls[2].body.contents[0].parts.filter(x=>x.inlineData).length,3);
  assert.equal(await page.locator('#sentRefsPreview img').count(),3);
  assert.match(await page.locator('#sentRefsSummary').textContent(),/not run/);
  svgDraft=true;
  await page.locator('#modeTabs button[data-mode="svg"]').click();
  await page.locator('#provider').selectOption('oai');
  await page.locator('#genBtn').click();
  await page.waitForSelector('#out iframe',{timeout:45000});
  await page.waitForFunction(()=>!document.querySelector('#genBtn').disabled);
  assert.match(await page.locator('#out iframe').getAttribute('srcdoc'),/Comic Sans MS/);
  assert.match(JSON.stringify(chatBodies.at(-1)),/Never add a figure-wide title banner or standalone title row/);
  assert.equal(await page.evaluate(()=>window.__ffExportState.reviewPending),true);
  assert.equal(await page.locator('#exportConfirm').isDisabled(),true);
  const svgDownloadPromise=page.waitForEvent('download');
  await page.locator('#dlSvg').click();
  const svgDownload=await svgDownloadPromise;
  const svgZip=readFileSync(await svgDownload.path());
  const svgRecord=JSON.parse(zipEntry(svgZip,'references.json').toString());
  assert.equal(svgRecord.outputKind,'step3-svg');
  assert.equal(svgRecord.selectedReferenceIds.length,10);
  assert.equal(svgRecord.generationReferenceIds.length,3);
  assert.match(zipEntry(svgZip,svgRecord.outputFile).toString(),/<svg/);
  const beforeSvgContinue=chatBodies.length;
  await page.locator('#continueToStep4').click();
  assert.equal(await page.evaluate(()=>window.__ffExportState.reviewPending),false);
  assert.equal(await page.locator('#exportFont').inputValue(),'Comic Sans MS');
  assert.equal((await page.evaluate(()=>window.__ffExportState.scene.nodes.find(n=>n.type==='text')?.fontFamily)).replaceAll('"',''),'Comic Sans MS');
  assert.equal(await page.locator('#exportConfirm').isEnabled(),true);
  assert.equal(chatBodies.length,beforeSvgContinue,'SVG continuation must not call another model');
  const exportPromise=page.waitForEvent('download');
  await page.locator('#exportConfirm').click();
  const exported=await exportPromise;
  const exportZip=readFileSync(await exported.path());
  const exportRecord=JSON.parse(zipEntry(exportZip,'references.json').toString());
  assert.equal(exportRecord.outputKind,'step4-svg');
  assert.equal(exportRecord.draftId,svgRecord.draftId);
  assert.deepEqual(exportRecord.selectedReferenceIds,svgRecord.selectedReferenceIds);
  assert.match(zipEntry(exportZip,exportRecord.outputFile).toString(),/<svg/);
  for(const format of ['drawio','pptx','vsdx']){
    await page.locator(`#exportActions [data-export="${format}"]`).click();
    const promise=page.waitForEvent('download');
    await page.locator('#exportConfirm').click();
    const file=await promise;
    const bytes=readFileSync(await file.path());
    const record=JSON.parse(zipEntry(bytes,'references.json').toString());
    assert.equal(record.outputKind,'step4-'+format);
    assert.equal(record.draftId,svgRecord.draftId);
    const output=zipEntry(bytes,record.outputFile);
    if(format==='drawio')assert.match(output.toString(),/<mxfile/);
    else assert.equal(output.readUInt32LE(0),0x04034b50);
  }
  const overlongSvg=await page.evaluate(()=>{
    window.__ffRenderSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><text x="20" y="40">${'A'.repeat(1301)}</text></svg>`,false,[],false);
    return document.querySelector('#out .hint').textContent;
  });
  assert.match(overlongSvg,/1,301.*target 1,300.*above target/);
  console.log('PASS browser: SVG/bitmap review gate, manual continuation, regeneration without paper reparse, private rotation, dual providers and error handling');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
