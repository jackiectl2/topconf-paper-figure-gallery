import {execFile} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execFileAsync=promisify(execFile);
const script=fileURLToPath(new URL('./figureforge-ocr.swift',import.meta.url));
const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};

export async function countFigureText({mimeType,data}){
  if(process.platform!=='darwin')throw new Error('macOS Vision OCR is unavailable');
  const ext=extensions[mimeType];
  if(!ext||typeof data!=='string'||!data||data.length>42*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))
    throw new Error('Invalid image payload');
  const folder=await mkdtemp(join(tmpdir(),'figureforge-ocr-'));
  try{
    const path=join(folder,`draft.${ext}`);
    await writeFile(path,Buffer.from(data,'base64'));
    const {stdout}=await execFileAsync('/usr/bin/swift',[script,path],{timeout:90000,maxBuffer:1024*1024});
    const characters=JSON.parse(stdout).characters;
    if(!Number.isSafeInteger(characters)||characters<0)throw new Error('Invalid OCR result');
    return {characters};
  }finally{await rm(folder,{recursive:true,force:true});}
}
