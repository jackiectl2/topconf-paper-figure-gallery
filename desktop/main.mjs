import {app,BrowserWindow,Menu,shell,dialog} from 'electron';
import {randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDesktopServer} from './server.mjs';

app.setName('FigureForgeTest');
const testDataRoot=process.env.FIGUREFORGE_TEST_USER_DATA && !app.isPackaged
  ? resolve(process.env.FIGUREFORGE_TEST_USER_DATA) : null;
app.setPath('userData',testDataRoot||join(app.getPath('appData'),'FigureForgeTest'));

let server;
let origin='';
let experimentNumber=0;
let lastFocusedWindow=null;
const windows=new Set();
const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));

async function copyPaperFrom(source){
  if(!source||source.isDestroyed())return null;
  return source.webContents.executeJavaScript(`(() => ({
    paper:document.querySelector('#paper')?.value||'',
    target:document.querySelector('#target')?.value||'pipeline',
    targetDesc:document.querySelector('#targetDesc')?.value||''
  }))()`);
}

async function createExperimentWindow({copyFrom=null}={}){
  const paper=await copyPaperFrom(copyFrom);
  const number=++experimentNumber;
  const window=new BrowserWindow({
    width:1440,height:980,minWidth:950,minHeight:700,
    title:`FigureForgeTest · Experiment ${number}`,backgroundColor:'#ffffff',
    webPreferences:{
      // No shared localStorage or IndexedDB between experiments. The shared
      // private image cache and key file remain outside browser storage.
      partition:`figureforge-experiment-${randomUUID()}`,
      nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true
    }
  });
  windows.add(window);
  lastFocusedWindow=window;
  window.on('focus',()=>{lastFocusedWindow=window;});
  window.on('closed',()=>{
    windows.delete(window);
    if(lastFocusedWindow===window)lastFocusedWindow=[...windows].at(-1)||null;
  });
  window.webContents.on('page-title-updated',event=>{
    event.preventDefault();
    window.setTitle(`FigureForgeTest · Experiment ${number}`);
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
  try{
    await window.loadURL(`${origin}/forge/`);
    await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
      const started=Date.now();
      const check=()=>{
        if(document.querySelector('#genBtn')?.onclick && document.querySelector('#target')?.onchange)resolve();
        else if(Date.now()-started>30000)reject(new Error('FigureForge page did not finish initializing'));
        else setTimeout(check,25);
      };
      check();
    })`);
    await window.webContents.executeJavaScript(`(() => {
      const brand=document.querySelector('header.top h1');
      if(brand?.firstChild)brand.firstChild.textContent='FigureForgeTest ';
      const title=document.querySelector('title');
      if(title){
        const windowTitle=${JSON.stringify(`FigureForgeTest · Experiment ${number}`)};
        const keepTitle=()=>{if(title.textContent!==windowTitle)title.textContent=windowTitle;};
        new MutationObserver(keepTitle).observe(title,{childList:true,characterData:true,subtree:true});
        keepTitle();
      }
    })()`);
    if(paper){
      await window.webContents.executeJavaScript(`(() => {
        const copied=${JSON.stringify(paper)};
        const target=document.querySelector('#target');
        if(target){target.value=copied.target;target.dispatchEvent(new Event('change',{bubbles:true}));}
        const description=document.querySelector('#targetDesc');
        if(description){description.value=copied.targetDesc;description.dispatchEvent(new Event('input',{bubbles:true}));}
        const field=document.querySelector('#paper');
        if(field){field.value=copied.paper;field.dispatchEvent(new Event('input',{bubbles:true}));}
      })()`);
    }
    window.setTitle(`FigureForgeTest · Experiment ${number}`);
    if(!app.isPackaged && process.env.FIGUREFORGE_TEST_NO_DEVTOOLS!=='1')
      window.webContents.openDevTools({mode:'detach',activate:false});
    return window;
  }catch(error){
    if(!window.isDestroyed())window.destroy();
    throw error;
  }
}

function openExperiment(copyCurrent){
  const source=copyCurrent?(BrowserWindow.getFocusedWindow()||lastFocusedWindow):null;
  void createExperimentWindow({copyFrom:source}).catch(()=>{
    dialog.showErrorBox('FigureForgeTest','Could not open the experiment window.');
  });
}

function installMenu(){
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {role:'appMenu'},
    {label:'File',submenu:[
      {id:'new-experiment',label:'New Experiment Window',accelerator:'CommandOrControl+N',click:()=>openExperiment(false)},
      {id:'duplicate-paper',label:'Duplicate Paper Into New Window',accelerator:'CommandOrControl+Shift+N',click:()=>openExperiment(true)},
      {type:'separator'},{role:'close'}
    ]},
    {role:'editMenu'},{role:'viewMenu'},{role:'windowMenu'}
  ]));
}

async function start(){
  const staticRoot=app.isPackaged?app.getAppPath():projectRoot;
  const privateRoot=join(app.getPath('userData'),'paperbananabench');
  server=createDesktopServer({staticRoot,privateRoot,keyFile:join(app.getPath('userData'),'figureforge_keys.env'),
    ...(testDataRoot?{sharedKeyFile:join(testDataRoot,'absent-shared-keys.env')}:{})});
  await new Promise((resolveListen,rejectListen)=>{
    server.once('error',rejectListen);
    server.listen(0,'127.0.0.1',resolveListen);
  });
  origin=`http://127.0.0.1:${server.address().port}`;
  installMenu();
  await createExperimentWindow();
}

app.whenReady().then(start).catch(()=>{
  // Startup errors and model credentials are never written to logs.
  process.stderr.write('FigureForgeTest desktop failed to start.\n');
  app.quit();
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(server)server.close();});
