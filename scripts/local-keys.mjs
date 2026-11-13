import {lstatSync,readFileSync} from 'node:fs';

export class LocalKeyError extends Error {
  constructor(status,message){super(message);this.status=status;}
}

export function readLocalKey(keyFile,provider){
  const name={openai:'OPENAI_API_KEY',gemini:'GEMINI_API_KEY'}[provider];
  if(!name)throw new LocalKeyError(400,'Unsupported local key provider.');
  let stat;
  try{stat=lstatSync(keyFile);}
  catch(error){
    if(error.code==='ENOENT')throw new LocalKeyError(404,'Local key file is not configured.');
    throw new LocalKeyError(503,'Local key file could not be read.');
  }
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.uid!==process.getuid())
    throw new LocalKeyError(403,'Local key file must be a regular file owned by you with mode 600.');
  if(stat.size>8192)throw new LocalKeyError(422,'Local key file format is invalid.');
  let contents;
  try{contents=readFileSync(keyFile,'utf8');}
  catch{throw new LocalKeyError(503,'Local key file could not be read.');}
  const values=new Map();
  for(const line of contents.replace(/^\uFEFF/,'').split(/\r?\n/)){
    if(!line.trim()||/^\s*#/.test(line))continue;
    const match=/^\s*(OPENAI_API_KEY|GEMINI_API_KEY)\s*=\s*(.*?)\s*$/.exec(line);
    if(!match||values.has(match[1]))throw new LocalKeyError(422,'Local key file format is invalid.');
    const value=match[2].replace(/^(["'])(.*)\1$/,'$2');
    if(value&&!/^[A-Za-z0-9._=-]+$/.test(value))throw new LocalKeyError(422,'Local key file format is invalid.');
    values.set(match[1],value);
  }
  const key=values.get(name);
  if(!key)throw new LocalKeyError(404,'This provider has no configured local key.');
  return key;
}
