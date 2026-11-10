import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const desktopRoot=resolve(fileURLToPath(new URL('.',import.meta.url)));
const binary=join(desktopRoot,'node_modules','electron','dist','Electron.app','Contents','MacOS','Electron');
if(!existsSync(binary))execFileSync(process.execPath,[join(desktopRoot,'node_modules','electron','install.js')],{stdio:'inherit'});
if(!existsSync(binary))throw new Error('Electron runtime was not installed.');
