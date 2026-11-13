import http from 'node:http';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {resolve, extname, sep, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {countFigureText} from '../forge/figure-text-ocr.mjs';
import {readLocalKey,LocalKeyError} from './local-keys.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.wasm':'application/wasm','.onnx':'application/octet-stream','.bin':'application/octet-stream'};
const allowedModels = new Set(['gemini-3.1-flash-image','gemini-3-pro-image']);

export function createPersonalServer({fetchImpl=fetch,ocrImpl=countFigureText,keyFile=join(root,'_local','ai_keys.env')}={}) {
  return http.createServer(async (req,res) => {
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    const local = `http://127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}`) { res.writeHead(403).end(); return; }
    let url;
    try { url = new URL(req.url, local); } catch { res.writeHead(400).end(); return; }
    if(url.pathname==='/api/local-key'){
      if(req.method!=='POST'||req.headers.origin!==local){res.writeHead(403).end();return;}
      let size=0;const chunks=[];
      try{
        for await(const chunk of req){size+=chunk.length;if(size>1024)throw new LocalKeyError(413,'Request too large.');chunks.push(chunk);}
        const {provider}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const key=readLocalKey(keyFile,provider);
        res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({key}));
      }catch(error){
        const status=error instanceof LocalKeyError?error.status:400;
        const message=error instanceof LocalKeyError?error.message:'Invalid local key request.';
        res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message}}));
      }
      return;
    }
    if(url.pathname==='/api/figure-text-count'){
      if(req.method!=='POST'||req.headers.origin!==local){res.writeHead(403).end();return;}
      let size=0;const chunks=[];
      try{
        for await(const chunk of req){size+=chunk.length;if(size>43*1024*1024)throw new Error('Request too large');chunks.push(chunk);}
        const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const result=await ocrImpl(payload);
        if(!Number.isSafeInteger(result?.characters)||result.characters<0)throw new Error('Invalid OCR result');
        res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));
      }catch{
        res.writeHead(size>43*1024*1024?413:503,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message:'Local image text check failed.'}}));
      }
      return;
    }
    if (url.pathname === '/api/gemini-image' || url.pathname === '/api/gemini-count' || url.pathname === '/api/openai-count') {
      if (req.method !== 'POST' || req.headers.origin !== local) { res.writeHead(403).end(); return; }
      const openai = url.pathname === '/api/openai-count';
      const key = String(req.headers[openai ? 'x-openai-api-key' : 'x-gemini-api-key'] || '');
      const model = String(req.headers[openai ? 'x-openai-model' : 'x-gemini-model'] || '');
      if (!key || (openai ? model !== 'gpt-6.1-sol' : !allowedModels.has(model))) { res.writeHead(400).end(JSON.stringify({error:{message:'Select a supported model and enter its key.'}})); return; }
      const chunks=[]; let size=0; const maxBytes=openai?70*1024*1024:32*1024*1024;
      try {
        for await (const chunk of req) { size+=chunk.length; if(size>maxBytes) throw new Error('Request too large'); chunks.push(chunk); }
        const payload=Buffer.concat(chunks);
        let parsed;
        try { parsed=JSON.parse(payload.toString('utf8')); } catch { res.writeHead(400).end(); return; }
        if(openai ? parsed?.model!==model || !Array.isArray(parsed?.input) : !Array.isArray(parsed?.contents)) { res.writeHead(400).end(); return; }
        const upstream=await fetchImpl(openai ? 'https://api.openai.com/v1/responses/input_tokens' :
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:${url.pathname === '/api/gemini-count' ? 'countTokens' : 'generateContent'}`,{
          method:'POST',headers:openai ? {'Content-Type':'application/json',Authorization:'Bearer '+key} : {'Content-Type':'application/json','x-goog-api-key':key},body:payload
        });
        const body=Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status,{'Content-Type':'application/json'}).end(body);
      } catch (error) {
        res.writeHead(size>maxBytes?413:502,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message:size>maxBytes?'Request too large':'Token count or Gemini connection failed.'}}));
      }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    let pathname;
    try { pathname=decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file=resolve(root,'.'+pathname);
    if (!(file===root || file.startsWith(root+sep)) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const isPrivate=pathname.startsWith('/_local/');
    if (isPrivate && !pathname.startsWith('/_local/paperbananabench/images/') && pathname !== '/_local/paperbananabench/manifest.json') { res.writeHead(404).end(); return; }
    if (isPrivate && ![undefined,'same-origin','none'].includes(req.headers['sec-fetch-site'])) { res.writeHead(403).end(); return; }
    res.writeHead(200,{'Content-Type':mime[extname(file).toLowerCase()]||'application/octet-stream'});
    if (req.method==='HEAD') res.end(); else createReadStream(file).pipe(res);
  });
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.FIGUREFORGE_PORT||8766);
  createPersonalServer().listen(port,'127.0.0.1',()=>process.stdout.write(`FigureForge: http://127.0.0.1:${port}/forge/\n`));
}
