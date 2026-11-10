import {chmodSync,copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';

const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const supportRoot=join(homedir(),'Library','Application Support');
const dataRoot=join(supportRoot,'FigureForgeTest');
const legacyDataRoot=join(supportRoot,'FigureForge');
const defaultDestination=join(dataRoot,'paperbananabench');
const imagePattern=/^images\/(?:ref|test)_\d+\.(?:jpg|jpeg|png|webp)$/;

export function installPrivateCache({sourceRoot=join(projectRoot,'_local','paperbananabench'),destinationRoot=defaultDestination}={}){
  if(destinationRoot===defaultDestination&&!existsSync(dataRoot)&&existsSync(legacyDataRoot))renameSync(legacyDataRoot,dataRoot);
  const manifestPath=join(sourceRoot,'manifest.json');
  if(!existsSync(manifestPath))throw new Error(`Private reference cache is missing: ${manifestPath}`);
  const source=readFileSync(manifestPath);
  const manifest=JSON.parse(source.toString('utf8'));
  if(!Array.isArray(manifest.figures)||manifest.figures.length!==42)throw new Error('Private reference manifest must contain exactly 42 figures');
  const seen=new Set();
  for(const figure of manifest.figures){
    if(!/^(?:ref|test)_\d+$/.test(figure.id)||!imagePattern.test(figure.image)||seen.has(figure.id)||!figure.image.startsWith(`images/${figure.id}.`))throw new Error('Invalid private reference image path');
    seen.add(figure.id);
    const image=join(sourceRoot,figure.image);
    if(!existsSync(image)||!lstatSync(image).isFile())throw new Error(`Private reference image is missing: ${figure.image}`);
  }
  mkdirSync(destinationRoot,{recursive:true,mode:0o700});
  mkdirSync(join(destinationRoot,'images'),{recursive:true,mode:0o700});
  chmodSync(destinationRoot,0o700);
  chmodSync(join(destinationRoot,'images'),0o700);
  for(const figure of manifest.figures){
    const target=join(destinationRoot,figure.image);
    copyFileSync(join(sourceRoot,figure.image),target);
    chmodSync(target,0o600);
  }
  writeFileSync(join(destinationRoot,'manifest.json'),source,{mode:0o600});
  chmodSync(join(destinationRoot,'manifest.json'),0o600);
  return manifest.figures.length;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const count=installPrivateCache();
  process.stdout.write(`Installed ${count} private reference images in Application Support.\n`);
}
