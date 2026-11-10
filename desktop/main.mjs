import {app,BrowserWindow,shell} from 'electron';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDesktopServer} from './server.mjs';

app.setName('FigureForge');
app.setPath('userData',join(app.getPath('appData'),'FigureForge'));

let server;
let window;
const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));

async function start(){
  const staticRoot=app.isPackaged?app.getAppPath():projectRoot;
  const privateRoot=join(app.getPath('userData'),'paperbananabench');
  server=createDesktopServer({staticRoot,privateRoot});
  await new Promise((resolveListen,rejectListen)=>{
    server.once('error',rejectListen);
    server.listen(0,'127.0.0.1',resolveListen);
  });
  const origin=`http://127.0.0.1:${server.address().port}`;
  window=new BrowserWindow({
    width:1440,height:980,minWidth:950,minHeight:700,
    title:'FigureForge',backgroundColor:'#ffffff',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
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
  if(!app.isPackaged)window.webContents.openDevTools({mode:'detach',activate:false});
}

app.whenReady().then(start).catch(error=>{
  // Startup errors contain no API credentials; requests are never logged.
  process.stderr.write(`FigureForge desktop failed to start: ${error.message}\n`);
  app.quit();
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(server)server.close();});
