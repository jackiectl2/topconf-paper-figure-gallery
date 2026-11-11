import http from 'node:http';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {extname, join, resolve, sep} from 'node:path';
import {countFigureText} from '../forge/figure-text-ocr.mjs';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.wasm':'application/wasm','.onnx':'application/octet-stream','.bin':'application/octet-stream'};
const allowedModels=new Set(['gemini-3.1-flash-image','gemini-3-pro-image']);

export function createDesktopServer({staticRoot,privateRoot,fetchImpl=fetch,ocrImpl=countFigureText}){
  if(!staticRoot||!privateRoot)throw new Error('Both staticRoot and privateRoot are required');
  return http.createServer(async(req,res)=>{
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    const local=`http://127.0.0.1:${req.socket.localPort}`;
    if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`){res.writeHead(403).end();return;}
    let url;
    try{url=new URL(req.url,local);}catch{res.writeHead(400).end();return;}
    if(url.pathname==='/api/figure-text-count'){
      if(req.method!=='POST'||req.headers.origin!==local){res.writeHead(403).end();return;}
      let size=0;const chunks=[];
      try{
        for await(const chunk of req){size+=chunk.length;if(size>43*1024*1024)throw new Error('Request too large');chunks.push(chunk);}
        const result=await ocrImpl(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        if(!Number.isSafeInteger(result?.characters)||result.characters<0)throw new Error('Invalid OCR result');
        res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));
      }catch{
        res.writeHead(size>43*1024*1024?413:503,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message:'Local image text check failed.'}}));
      }
      return;
    }
    if(url.pathname==='/api/gemini-image'){
      if(req.method!=='POST'||req.headers.origin!==local){res.writeHead(403).end();return;}
      const key=String(req.headers['x-gemini-api-key']||'');
      const model=String(req.headers['x-gemini-model']||'');
      if(!key||!allowedModels.has(model)){res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message:'Select a supported Gemini image model and enter its key.'}}));return;}
      const chunks=[];let size=0;
      try{
        for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw new Error('Request too large');chunks.push(chunk);}
        const upstream=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:Buffer.concat(chunks)});
        const body=Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status,{'Content-Type':'application/json'}).end(body);
      }catch{
        res.writeHead(size>32*1024*1024?413:502,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message:size>32*1024*1024?'Request too large':'Gemini connection failed.'}}));
      }
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    let pathname;
    try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
    if(pathname.includes('\\')||pathname.includes('\0')){res.writeHead(404).end();return;}
    // Each app launch uses a fresh local port. Avoid a new large service-worker cache per launch.
    if(pathname==='/forge/sw.js'){res.writeHead(404).end();return;}
    let base,relative;
    if(pathname==='/_local/paperbananabench/manifest.json'){base=privateRoot;relative='manifest.json';}
    else if(/^\/_local\/paperbananabench\/images\/(?:ref|test)_\d+\.(?:jpg|jpeg|png|webp)$/.test(pathname)){base=privateRoot;relative=pathname.slice('/_local/paperbananabench/'.length);}
    else if(/^\/(?:forge|assets|images)\//.test(pathname)){base=staticRoot;relative=pathname.slice(1);if(relative.endsWith('/'))relative+='index.html';}
    else{res.writeHead(404).end();return;}
    if(base===privateRoot&&![undefined,'same-origin','none'].includes(req.headers['sec-fetch-site'])){res.writeHead(403).end();return;}
    const root=resolve(base),file=resolve(join(root,relative));
    if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[extname(file).toLowerCase()]||'application/octet-stream'});
    if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  });
}
