import {lstatSync,readFileSync} from 'node:fs';

export class LocalKeyError extends Error {
  constructor(status,message){super(message);this.status=status;}
}

function readOwnedKeyFile(keyFile){
  let stat;
  try{stat=lstatSync(keyFile);}
  catch(error){
    if(error.code==='ENOENT')throw new LocalKeyError(404,'Local key file is not configured.');
    throw new LocalKeyError(503,'Local key file could not be read.');
  }
  if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0||stat.uid!==process.getuid())
    throw new LocalKeyError(403,'Local key file must be a regular file owned by you with mode 600.');
  if(stat.size>8192)throw new LocalKeyError(422,'Local key file format is invalid.');
  try{return readFileSync(keyFile,'utf8').replace(/^\uFEFF/,'');}
  catch{throw new LocalKeyError(503,'Local key file could not be read.');}
}

export function readSharedLocalKey(keyFile,provider){
  const name={openai:'OPENAI_API_KEY',gemini:'GOOGLE_API_KEY'}[provider];
  if(!name)throw new LocalKeyError(400,'Unsupported local key provider.');
  const contents=readOwnedKeyFile(keyFile);
  let found=false,key='';
  for(const line of contents.split(/\r?\n/)){
    if(!new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line))continue;
    if(found)throw new LocalKeyError(422,'Local key file format is invalid.');
    found=true;
    const match=new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s#]+))\\s*(?:#.*)?$`).exec(line);
    if(!match)throw new LocalKeyError(422,'Local key file format is invalid.');
    key=match[1]??match[2]??match[3]??'';
    if(key&&!/^[A-Za-z0-9._=-]+$/.test(key))throw new LocalKeyError(422,'Local key file format is invalid.');
  }
  if(!key)throw new LocalKeyError(404,'This provider has no configured local key.');
  return key;
}

export function readLocalKey(keyFile,provider){
  const name={openai:'OPENAI_API_KEY',gemini:'GEMINI_API_KEY'}[provider];
  if(!name)throw new LocalKeyError(400,'Unsupported local key provider.');
  const contents=readOwnedKeyFile(keyFile);
  const values=new Map();
  for(const line of contents.split(/\r?\n/)){
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
