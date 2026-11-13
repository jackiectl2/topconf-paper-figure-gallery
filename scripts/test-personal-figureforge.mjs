import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ReferenceSampler,sampleGenerationReferences} from '../forge/private-reference-sampler.mjs';
import {normalizeOpenAIChat} from '../forge/openai-parameters.mjs';
import {createPersonalServer} from './serve-personal-figureforge.mjs';

test('private references rotate through the full collection before repeats',()=>{
  const ids=Array.from({length:42},(_,i)=>`item-${i}`);
  const sampler=new ReferenceSampler(ids,()=>0.25);
  const first=[...sampler.draw(10),...sampler.draw(10),...sampler.draw(10),...sampler.draw(10)];
  assert.equal(new Set(first).size,40);
  const crossing=sampler.draw(4);
  assert.equal(new Set(crossing).size,4);
  assert.equal(new Set([...first,...crossing]).size,42);
  assert.throws(()=>sampler.draw(0),/1–10/);
  assert.throws(()=>sampler.draw(11),/1–10/);
});

test('one to ten references can be drawn, and generation sees at most three',()=>{
  const ids=Array.from({length:42},(_,i)=>`item-${i}`);
  const sampler=new ReferenceSampler(ids,()=>0.25);
  assert.equal(sampler.draw(1).length,1);
  assert.equal(new Set(sampler.draw(10)).size,10);
  for(const n of [1,2,3,4,10]){
    const selected=ids.slice(0,n);
    const sent=sampleGenerationReferences(selected,()=>0.25);
    assert.equal(sent.length,Math.min(n,3));
    assert.equal(new Set(sent).size,sent.length);
    assert.ok(sent.every(id=>selected.includes(id)));
    if(n<=3)assert.deepEqual(sent,selected);
  }
  assert.throws(()=>sampler.draw(0),/1–10/);
  assert.throws(()=>sampler.draw(11),/1–10/);
});

test('OpenAI default and explicit reasoning use compatible chat fields',()=>{
  for(const model of ['gpt-6.1-sol','gpt-5.4','o3']){
    const source={model,max_tokens:16000,temperature:0.2,top_p:0.9,messages:[]};
    const result=normalizeOpenAIChat(source);
    assert.equal(result.max_completion_tokens,16000);
    assert.equal('max_tokens' in result,false);
    assert.equal('temperature' in result,false);
    assert.equal('top_p' in result,false);
    assert.equal(source.max_tokens,16000);
  }
  assert.deepEqual(normalizeOpenAIChat({model:'gpt-4o',max_tokens:5000,temperature:0.2}),{model:'gpt-4o',max_tokens:5000,temperature:0.2});
  assert.deepEqual(normalizeOpenAIChat({model:'gpt-6.1-sol',input:[],max_output_tokens:5000}),{model:'gpt-6.1-sol',input:[],max_output_tokens:5000});
});

test('localhost Gemini relay uses native API, never bearer authorization or logged keys',async()=>{
  const calls=[];
  const server=createPersonalServer({ocrImpl:async payload=>{
    assert.equal(payload.mimeType,'image/png');
    assert.equal(payload.data,'YQ==');
    return {characters:1299};
  },fetchImpl:async(url,init)=>{
    calls.push({url,headers:init.headers,body:JSON.parse(init.body.toString())});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'YQ=='}}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const request={contents:[{parts:[{text:'draw'},{inlineData:{mimeType:'image/png',data:'YQ=='}}]}]};
    const response=await fetch(origin+'/api/gemini-image',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-gemini-api-key':'fake-test-key','x-gemini-model':'gemini-3.1-flash-image'},body:JSON.stringify(request)});
    assert.equal(response.status,200);
    assert.equal(calls.length,1);
    const counted=await fetch(origin+'/api/gemini-count',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-gemini-api-key':'fake-test-key','x-gemini-model':'gemini-3-pro-image'},body:JSON.stringify({contents:request.contents})});
    assert.equal(counted.status,200);
    assert.match(calls[1].url,/gemini-3-pro-image:countTokens$/);
    const openaiCount=await fetch(origin+'/api/openai-count',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','x-openai-api-key':'fake-test-key','x-openai-model':'gpt-6.1-sol'},body:JSON.stringify({model:'gpt-6.1-sol',input:[]})});
    assert.equal(openaiCount.status,200);
    assert.equal(calls[2].url,'https://api.openai.com/v1/responses/input_tokens');
    assert.equal(calls[2].headers.Authorization,'Bearer fake-test-key');
    assert.match(calls[0].url,/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.1-flash-image:generateContent$/);
    assert.equal(calls[0].headers['x-goog-api-key'],'fake-test-key');
    assert.equal('Authorization' in calls[0].headers,false);
    assert.deepEqual(calls[0].body,request);
    assert.equal((await fetch(origin+'/_local/paperbananabench/special_ids.txt')).status,404);
    assert.equal((await fetch(origin+'/api/gemini-image',{method:'POST',headers:{Origin:'https://other.example','x-gemini-api-key':'fake-test-key','x-gemini-model':'gemini-3.1-flash-image'}})).status,403);
    const ocr=await fetch(origin+'/api/figure-text-count',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mimeType:'image/png',data:'YQ=='})});
    assert.deepEqual(await ocr.json(),{characters:1299});
    assert.equal((await fetch(origin+'/api/figure-text-count',{method:'POST',headers:{Origin:'https://other.example'},body:'{}'})).status,403);
    assert.equal(calls.length,3);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('local key endpoint reads only the matching fake key with same-origin protection',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'figureforge-local-keys-'));
  const keyFile=join(folder,'ai_keys.env');
  writeFileSync(keyFile,'OPENAI_API_KEY=mock-openai-secret\nGEMINI_API_KEY=mock-gemini-secret\n',{mode:0o600});
  const server=createPersonalServer({keyFile});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=(provider,headers={})=>fetch(origin+'/api/local-key',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({provider})});
  try{
    const openai=await request('openai');
    assert.equal(openai.status,200);
    assert.deepEqual(await openai.json(),{key:'mock-openai-secret'});
    assert.equal(openai.headers.get('cache-control'),'no-store');
    assert.deepEqual(await (await request('gemini')).json(),{key:'mock-gemini-secret'});
    assert.equal((await request('openai',{Origin:'https://other.example'})).status,403);
    assert.equal((await request('infistar')).status,400);
    assert.equal((await fetch(origin+'/_local/ai_keys.env')).status,404);
    chmodSync(keyFile,0o644);
    assert.equal((await request('openai')).status,403);
    chmodSync(keyFile,0o600);
    writeFileSync(keyFile,'OPENAI_API_KEY=bad key\n',{mode:0o600});
    assert.equal((await request('openai')).status,422);
    rmSync(keyFile);
    assert.equal((await request('openai')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(folder,{recursive:true,force:true});}
});
