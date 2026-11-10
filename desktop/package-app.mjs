import {copyFileSync,existsSync,linkSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {packager} from '@electron/packager';

const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const desktopRoot=join(projectRoot,'desktop');
const buildRoot=join(projectRoot,'_local','desktop-build');
const stage=join(buildRoot,'stage');
const out=join(buildRoot,'dist');

if(process.platform!=='darwin'||process.arch!=='arm64')throw new Error('This build script targets this Mac (macOS arm64).');
rmSync(stage,{recursive:true,force:true});
mkdirSync(stage,{recursive:true});
const tracked=execFileSync('git',['ls-files','-z','--','forge','assets','images'],{cwd:projectRoot,maxBuffer:64*1024*1024}).toString('utf8').split('\0').filter(Boolean);
if(!tracked.some(path=>path==='forge/index.html'))throw new Error('FigureForge entrypoint was not found in Git.');
for(const path of tracked){
  const from=join(projectRoot,path),to=join(stage,path);
  if(!existsSync(from))throw new Error(`Tracked app file is missing: ${path}`);
  mkdirSync(resolve(to,'..'),{recursive:true});
  try{linkSync(from,to);}catch{copyFileSync(from,to);}
}
for(const name of ['main.mjs','server.mjs'])copyFileSync(join(desktopRoot,name),join(stage,name));
const {name,version,type,main}=JSON.parse(readFileSync(join(desktopRoot,'package.json'),'utf8'));
writeFileSync(join(stage,'package.json'),JSON.stringify({name,version,type,main}));
rmSync(out,{recursive:true,force:true});
mkdirSync(out,{recursive:true});
const appPaths=await packager({dir:stage,out,name:'FigureForge',platform:'darwin',arch:'arm64',electronVersion:'45.3.0',asar:false,overwrite:true,prune:true,appVersion:version,executableName:'FigureForge'});
if(appPaths.length!==1)throw new Error('Expected one packaged application.');
process.stdout.write(`${appPaths[0]}\n`);
