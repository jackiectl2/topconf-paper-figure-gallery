import {app,BrowserWindow,shell} from 'electron';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDesktopServer} from './server.mjs';

app.setName('FigureForgeTest');
app.setPath('userData',join(app.getPath('appData'),'FigureForgeTest'));

let server;
let window;
const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));

async function start(){
  const staticRoot=app.isPackaged?app.getAppPath():projectRoot;
  const privateRoot=join(app.getPath('userData'),'paperbananabench');
  server=createDesktopServer({staticRoot,privateRoot,keyFile:join(app.getPath('userData'),'figureforge_keys.env')});
  await new Promise((resolveListen,rejectListen)=>{
    server.once('error',rejectListen);
    server.listen(0,'127.0.0.1',resolveListen);
  });
  const origin=`http://127.0.0.1:${server.address().port}`;
  window=new BrowserWindow({
    width:1440,height:980,minWidth:950,minHeight:700,
    title:'FigureForgeTest',backgroundColor:'#ffffff',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
  });
  window.webContents.on('page-title-updated',event=>{
    event.preventDefault();
    window.setTitle('FigureForgeTest');
  });
  window.webContents.on('will-navigate',(event,target)=>{
    if(target.startsWith(`${origin}/`))return;
    event.preventDefault();
    if(/^https:\/\//.test(target))void shell.openExternal(target);
  });
  window.webContents.setWindowOpenHandler(({url})=>{
    if(/^https:\/\//.test(url))void shell.openExternal(url);
    return {action:'deny'};
  });
  await window.loadURL(`${origin}/forge/`);
  await window.webContents.executeJavaScript(`(() => {
    const brand=document.querySelector('header.top h1');
    if(brand?.firstChild)brand.firstChild.textContent='FigureForgeTest ';
    const title=document.querySelector('title');
    if(title){
      const rename=()=>{const next=title.textContent.replace(/^FigureForge(?= ·)/,'FigureForgeTest');if(next!==title.textContent)title.textContent=next;};
      new MutationObserver(rename).observe(title,{childList:true,characterData:true,subtree:true});
      rename();
    }
  })()`);
  if(!app.isPackaged)window.webContents.openDevTools({mode:'detach',activate:false});
}

app.whenReady().then(start).catch(error=>{
  // Startup errors contain no API credentials; requests are never logged.
  process.stderr.write(`FigureForgeTest desktop failed to start: ${error.message}\n`);
  app.quit();
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(server)server.close();});
