import assert from 'node:assert/strict';
import {createPersonalServer} from './serve-personal-figureforge.mjs';

const {chromium}=await import('../_local/test/node_modules/playwright-core/index.mjs');
const sections=Array.from({length:12},(_,i)=>({section:`Section ${i+1}`,summary:`Component ${i+1} receives input and emits output to the next stage.`,evidence:`Page ${i+1}`}));
const visualModules=Array.from({length:12},(_,i)=>({name:`Component ${i+1}`,role:`Stage ${i+1}`,inputs:[`Input ${i+1}`],outputs:[`Output ${i+1}`],connectsTo:i<11?[`Component ${i+2}`]:[],visual:'icon',evidence:`Page ${i+1}`}));
const calls=[];
let rejectCount=false;
const server=createPersonalServer({fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body.toString());
  calls.push({url,headers:init.headers,body});
  if(rejectCount||Object.keys(body).sort().join(',')!=='input,model') return new Response(JSON.stringify({error:{code:'unknown_parameter',param:'max_output_tokens'}}),{status:400,headers:{'Content-Type':'application/json'}});
  return new Response(JSON.stringify({input_tokens:4500}),{headers:{'Content-Type':'application/json'}});
}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const responses=[];
try{
  await page.route('https://api.openai.com/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/models'))return route.fulfill({json:{data:[{id:'gpt-6.1-sol'}]}});
    if(url.pathname.endsWith('/responses')){
      responses.push(route.request().postDataJSON());
      return route.fulfill({json:{status:'completed',output_text:JSON.stringify({title:'Dense paper',selectedSections:sections,visualModules,figurePrompt:'Draw all twelve connected components.'})}});
    }
    return route.fulfill({status:404,json:{error:{message:'mock unavailable'}}});
  });
  await page.goto(origin+'/forge/',{waitUntil:'domcontentloaded'});
  await page.locator('#provider').selectOption('oai');
  await page.locator('#keySource').selectOption('manual');
  await page.locator('#key').fill('fake-test-key');
  await page.waitForFunction(()=>[...document.querySelector('#parseModel').options].some(x=>x.value==='gpt-6.1-sol'));
  await page.locator('#parseModel').selectOption('gpt-6.1-sol');
  await page.locator('#pdfFile').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nsynthetic fixture')});
  await page.waitForFunction(()=>document.querySelector('#paper').value.includes('Component 12'),{timeout:15000});
  const paper=await page.locator('#paper').inputValue();
  assert.equal((paper.match(/\[Section \d+\]/g)||[]).length,12);
  assert.match(paper,/Component 12/);
  assert.match(paper,/Drawable module inventory \(12\)/);
  assert.match(paper,/connects to: Component 12/);
  assert.match(await page.locator('#pdfBudgetStatus').textContent(),/4,500.*12 relevant sections/);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://api.openai.com/v1/responses/input_tokens');
  assert.equal(calls[0].headers.Authorization,'Bearer fake-test-key');
  assert.deepEqual(Object.keys(calls[0].body).sort(),['input','model']);
  assert.equal(responses.length,1);
  assert.equal(responses[0].input[0].content[0].type,'input_file');
  rejectCount=true;
  await page.locator('#pdfFile').setInputFiles({name:'synthetic-failure.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nerror fixture')});
  await page.waitForFunction(()=>document.querySelector('#contentModeHint')?.dataset.state==='error',{timeout:15000});
  assert.equal(calls.length,2,'a failed count must not repeat on text and image fallbacks');
  assert.equal(responses.length,1,'generation must not start after failed count');
  assert.match(await page.locator('#parseErr').textContent(),/HTTP 400; unknown_parameter, max_output_tokens/);
  assert.deepEqual(errors,[]);
  console.log('PASS browser: mocked PDF upload retains all 12 sections and counts GPT input');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
