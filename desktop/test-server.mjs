import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDesktopServer} from './server.mjs';
import {installPrivateCache} from './install-private-cache.mjs';

test('desktop server serves only bundled content and private runtime images',async()=>{
  const root=mkdtempSync(join(tmpdir(),'figureforge-desktop-'));
  const staticRoot=join(root,'app'),privateRoot=join(root,'private');
  mkdirSync(join(staticRoot,'forge'),{recursive:true});
  mkdirSync(join(privateRoot,'images'),{recursive:true});
  writeFileSync(join(staticRoot,'forge','index.html'),'<title>FigureForge</title>');
  writeFileSync(join(staticRoot,'forge','sw.js'),'should not register');
  writeFileSync(join(privateRoot,'manifest.json'),'{}');
  writeFileSync(join(privateRoot,'images','ref_1.png'),'PNG');
  writeFileSync(join(privateRoot,'special_ids.txt'),'SECRET');
  const upstream=[];
  const server=createDesktopServer({staticRoot,privateRoot,ocrImpl:async()=>({characters:42}),fetchImpl:async(url,init)=>{
    upstream.push({url,headers:init.headers,body:JSON.parse(init.body.toString())});
    return new Response(JSON.stringify({candidates:[]}),{headers:{'Content-Type':'application/json'}});
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.match(await (await fetch(origin+'/forge/')).text(),/FigureForge/);
    assert.equal((await fetch(origin+'/forge/sw.js')).status,404);
    assert.equal((await fetch(origin+'/_local/paperbananabench/manifest.json')).status,200);
    assert.equal(await (await fetch(origin+'/_local/paperbananabench/images/ref_1.png')).text(),'PNG');
    assert.equal((await fetch(origin+'/_local/paperbananabench/special_ids.txt')).status,404);
    assert.equal((await fetch(origin+'/main.mjs')).status,404);
    assert.equal((await fetch(origin+'/forge/%2e%2e/%2e%2e/main.mjs')).status,404);
    assert.equal((await fetch(origin+'/api/gemini-image',{method:'POST',headers:{Origin:'https://foreign.example','x-gemini-api-key':'fake','x-gemini-model':'gemini-3-pro-image'},body:'{}'})).status,403);
    const result=await fetch(origin+'/api/gemini-image',{method:'POST',headers:{Origin:origin,'x-gemini-api-key':'fake','x-gemini-model':'gemini-3-pro-image','Content-Type':'application/json'},body:'{"contents":[]}'});
    assert.equal(result.status,200);
    assert.equal(upstream[0].url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent');
    assert.equal(upstream[0].headers['x-goog-api-key'],'fake');
    assert.equal(upstream[0].headers.Authorization,undefined);
    const geminiCount=await fetch(origin+'/api/gemini-count',{method:'POST',headers:{Origin:origin,'x-gemini-api-key':'fake','x-gemini-model':'gemini-3-pro-image','Content-Type':'application/json'},body:'{"contents":[]}'});
    assert.equal(geminiCount.status,200);
    assert.equal(upstream[1].url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:countTokens');
    assert.equal(upstream[1].headers['x-goog-api-key'],'fake');
    assert.equal(upstream[1].headers.Authorization,undefined);
    const openaiCount=await fetch(origin+'/api/openai-count',{method:'POST',headers:{Origin:origin,'x-openai-api-key':'fake','x-openai-model':'gpt-6.1-sol','Content-Type':'application/json'},body:'{"model":"gpt-6.1-sol","input":[]}'});
    assert.equal(openaiCount.status,200);
    assert.equal(upstream[2].url,'https://api.openai.com/v1/responses/input_tokens');
    assert.equal(upstream[2].headers.Authorization,'Bearer fake');
    assert.equal(upstream[2].headers['x-goog-api-key'],undefined);
    assert.equal((await fetch(origin+'/api/openai-count',{method:'POST',headers:{Origin:origin,'x-openai-api-key':'fake','x-openai-model':'gpt-6.1-sol','Content-Type':'application/json'},body:'{"model":"gpt-5","input":[]}'})).status,400);
    assert.equal((await fetch(origin+'/api/gemini-count',{method:'POST',headers:{Origin:'https://foreign.example','x-gemini-api-key':'fake','x-gemini-model':'gemini-3-pro-image'},body:'{"contents":[]}'})).status,403);
    assert.equal(upstream.length,3);
    const ocr=await fetch(origin+'/api/figure-text-count',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"mimeType":"image/png","data":"YQ=="}'});
    assert.deepEqual(await ocr.json(),{characters:42});
  }finally{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
});

test('private cache installer copies only manifest and referenced images',()=>{
  const root=mkdtempSync(join(tmpdir(),'figureforge-cache-'));
  const sourceRoot=join(root,'source'),destinationRoot=join(root,'destination');
  mkdirSync(join(sourceRoot,'images'),{recursive:true});
  const figures=Array.from({length:42},(_,i)=>({id:`ref_${i+1}`,image:`images/ref_${i+1}.png`}));
  for(const figure of figures)writeFileSync(join(sourceRoot,figure.image),'PNG');
  writeFileSync(join(sourceRoot,'manifest.json'),JSON.stringify({figures}));
  writeFileSync(join(sourceRoot,'special_ids.txt'),'SECRET');
  try{
    assert.equal(installPrivateCache({sourceRoot,destinationRoot}),42);
    assert.deepEqual(JSON.parse(readFileSync(join(destinationRoot,'manifest.json'),'utf8')).figures,figures);
    assert.equal(existsSync(join(destinationRoot,'special_ids.txt')),false);
    assert.equal(existsSync(join(destinationRoot,'images','ref_42.png')),true);
    figures[0].image='../special_ids.txt';
    writeFileSync(join(sourceRoot,'manifest.json'),JSON.stringify({figures}));
    assert.throws(()=>installPrivateCache({sourceRoot,destinationRoot}),/Invalid private reference image path/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
