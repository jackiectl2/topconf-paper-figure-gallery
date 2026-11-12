import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';

const source=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function callPdfParserCovered('),source.indexOf('function renderPdfSummary('));
function harness(total){
  const calls=[],status={textContent:''};
  const context={URL,MAX_PDF_IMAGES:8,parserModel:()=> 'gpt-6.1-sol',baseURL:()=> 'https://api.openai.com/v1',
    $:()=>status,
    extractPdfImages:async start=>({start,total,pages:Math.min(8,total-start+1),imgs:[]}),
    callPdfParser:async(mode,payload)=>{
      calls.push({mode,payload});
      const pages=mode==='text'?[...payload.text.matchAll(/\[\[Page (\d+)\]\]/g)].map(x=>Number(x[1])):
        Array.from({length:payload.pages},(_,i)=>payload.start+i);
      return {title:'Paper',selectedSections:pages.map(p=>({section:`Page ${p}`,summary:`Module ${p}`})),figurePrompt:`Draw pages ${pages.join(',')}`};
    }};
  runInNewContext(code+'\nthis.covered=callPdfParserCovered;',context);
  return {calls,status,covered:context.covered};
}

test('GPT text fallback includes late pages instead of first 60,000 characters',async()=>{
  const {calls,covered,status}=harness(13);
  const text=Array.from({length:13},(_,i)=>`[[Page ${i+1}]]\nComponent ${i+1}`).join('\n\n');
  const result=await covered('text',{text,pages:13});
  assert.equal(calls.length,1);
  assert.equal(result.selectedSections.length,13);
  assert.equal(result.selectedSections.at(-1).summary,'Module 13');
  assert.match(status.textContent,/13\/13 pages/);
});

test('GPT rendered-image fallback covers every page in eight-page batches',async()=>{
  const {calls,covered,status}=harness(20);
  const result=await covered('img',{start:1,total:20,pages:8,imgs:[]});
  assert.deepEqual(calls.map(x=>x.payload.start),[1,9,17]);
  assert.equal(result.selectedSections.length,20);
  assert.equal(result.selectedSections.at(-1).summary,'Module 20');
  assert.match(status.textContent,/20\/20 pages/);
});
