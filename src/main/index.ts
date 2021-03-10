import { app, BrowserWindow, ipcMain, Menu, dialog} from 'electron';
import * as fs from 'fs';

import {startServer, slajdomatSettings, readPresentations, saveSettings, loadSettings, assignSettings} from './server'
export {sendStatus, mainWindow}

//this is the link to the main window html, produced by the despicable webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_WEBPACK_ENTRY: string;

//the main window with the presentation list 
let mainWindow = null as BrowserWindow;

function sendStatus(text: string) : void {
  mainWindow.webContents.send('status-update', text);
}

  
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
            nodeIntegration: true
          }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-finish-load', () => {
    startApp(); 
  })

  //this might be a bit nonstandard for mac, but the app only makes sense when the main window is open
  mainWindow.on('close', app.quit)
  
};


function createMenu() 
{

const isMac = process.platform === 'darwin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const template : any = [
  // { role: 'appMenu' }
  ...(isMac ? [{
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label : 'Preferences', click : openPreferences, accelerator : 'CommandOrControl+.'},
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []),
  // { role: 'fileMenu' }
  {
    label: 'File',
    submenu: [
      { label : 'Choose presentations folder', click : openFolder, accelerator : 'CommandOrControl+O'},
      isMac ? { role: 'close' } : { role: 'quit' },
      
    ]
  },
  // { role: 'editMenu' }
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac ? [
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [
            { role: 'startSpeaking' },
            { role: 'stopSpeaking' }
          ]
        }
      ] : [
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ])
    ]
  },
  // { role: 'viewMenu' }
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac ? [
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ] : [
        { role: 'close' }
      ])
    ]
  },
]
const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

createMenu();

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.


ipcMain.on('open-viewer', (event, arg) => {
  console.log(arg) // prints "ping"
  // event.reply('asynchronous-reply', 'pong')

  const offset = mainWindow.getPosition();
  const viewerWin = new BrowserWindow({
    width: 800,
    height: 600,
    x : offset[0]+20,
    y : offset[1]+20,
    webPreferences: {
      nodeIntegration: true
    }
  })
  
  viewerWin.loadFile(slajdomatSettings.directory + '/' + arg + '/index.html')
})





//the menu item for choosing a presentation directory
function openFolder()  : Promise<void> {
  return dialog.showOpenDialog({ properties: ['openDirectory'] }).then(
    result => {
      if (!result.canceled) 
        {
          console.log('not cancelled')
          slajdomatSettings.directory = result.filePaths[0];
          readPresentations();
          saveSettings();
        }
    }
  );
}


let preferencesWindow : BrowserWindow;
//open the preferences, which for the moment only uses the port number
function openPreferences() : void {
  console.log('preferences')
  preferencesWindow = new BrowserWindow({
    height: 150,
    width: 200,
    frame : false,
    webPreferences: {
            nodeIntegration: true
          }
  });

  // and load the index.html of the app.
  preferencesWindow.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY);
  preferencesWindow.webContents.on('did-finish-load', () => {
    preferencesWindow.webContents.send('settings', slajdomatSettings)
});
}

//the preferences window was closed, either through ok or cancel
ipcMain.on('settings-closed', (event, arg) => {
  if (arg != undefined) {
    //the settings window was not  cancelled
    assignSettings(arg);
  }
  preferencesWindow.close();
})

function startApp() : void
{
  loadSettings();
  if (fs.existsSync(slajdomatSettings.directory) && 
  fs.lstatSync(slajdomatSettings.directory).isDirectory() )
  {
    readPresentations();
  }
    
  startServer();
}