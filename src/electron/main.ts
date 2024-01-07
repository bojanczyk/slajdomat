/*
This is the main file for the electron backend, which is referred to as the "main" process, as opposed to the "renderer" process. The "renderer" has its main file in the renderer.ts.

This file contains mainly boilerplate code, which intializes the backend, and handles the user interface elements which are controlled by the backend, such as menus. 

The main purpose of this code is to dispatch the events to the various files main-*, where the logic is actually located.
*/


import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron';
import { createMenu } from './menubar'


import * as fs from 'fs'
import * as path from 'path'

import { startServer,  } from './main-server'

import {slajdomatSettings, saveSettings, loadSettings, assignSettings, SlajdomatSettings, checkIfCommentServerWorks } from './main-settings'

import { readPresentations, gotoChild, gotoParent, revealFinder,  setResourceDir, downloadViewerFiles } from './main-files'



import { ElectronRendererToMain, ElectronMainToRenderer } from './messages-main-renderer';
import { runUploadScript, saveUploadScript } from './main-upload';


export { sendStatus, mainWindow, choosePresentationsFolder, sendMessageToRenderer }

//this is the link to the main window html, produced by the despicable webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

//the main window with the presentation list 
let mainWindow = null as BrowserWindow;



function sendStatus(text: string, subtype: 'quick' | 'log' | 'upload' = 'log'): void {
  sendMessageToRenderer({ type: 'status-update', text: text, subtype: subtype });
}


//the interface for sending a message from the renderer process to the main process. This function is used so that there is a typed message, whose type can be used to see all possible message
function sendMessageToRenderer(msg: ElectronMainToRenderer): void {
  mainWindow.webContents.send('message-to-renderer', msg);
}


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {

  /*  
  // the electron documentation suggests something like this, but it does not work for me
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'none' "
          ]
        }
      })
    })
    */

  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 600,
    width: 400,
    webPreferences: {
      nodeIntegration: true,
      // for modern versions of electron the following is also needed to enable interprocess communication
      // (otherwise one should use contextBridge)
      contextIsolation: false,
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

//the user has clicked a presentation name, which should result in opening that presentation in a new window
function openViewer(name: string) {
  console.log('opening viewer', name);
  const offset = mainWindow.getPosition();
  const viewerWin = new BrowserWindow({
    width: 800,
    height: 600,
    x: offset[0] + 20,
    y: offset[1] + 20,
    webPreferences: {
      nodeIntegration: true,
      // for modern versions of electron the following is also needed to enable interprocess communication
      // (otherwise one should use contextBridge)
      contextIsolation: false,
    },
    show: false
  })


  viewerWin.loadFile(path.join(name, 'index.html'));
  viewerWin.once('ready-to-show', () => {
    viewerWin.show();
    viewerWin.webContents.executeJavaScript("window.runFromApp('" + name + "')");

    // Open the DevTools.
    //viewerWin.webContents.openDevTools();
  })
}



//the menu item for choosing a presentation directory
async function choosePresentationsFolder(): Promise<void> {

  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (!result.canceled) {
    slajdomatSettings.directory = result.filePaths[0];
    readPresentations(slajdomatSettings.directory);
    saveSettings();
  }
}


function startApp(): void {

  try {
    loadSettings()
    if (fs.existsSync(slajdomatSettings.directory) &&
      fs.lstatSync(slajdomatSettings.directory).isDirectory()) {
      readPresentations(slajdomatSettings.directory);
    }
    startServer();
    setResourceDir();
  }

  catch (e) {
    dialog.showMessageBox({
      type: 'info',
      title: 'Alert',
      message: 'The app could not load the settings or presentations.',
      buttons: ['Too bad, I will quit now.'],
    });
  }
}


//the event handler for messages from the renderer process
ipcMain.on('message-to-main', (event, arg) => {
  const message = arg as ElectronRendererToMain;

  switch (message.type) {
    case 'choose-presentations-folder':
      choosePresentationsFolder();
      break;

    case 'reveal-in-finder':
      revealFinder(message.name, message.kind);
      break;

    case 'open-viewer':
      openViewer(path.join(message.dir, message.file));
      break;

    case 'goto-folder':
      gotoChild(message.name);
      break;

    case 'upgrade':
      //not currently used
      throw ('upgrade event is not currently supported');
      //   upgradePresentation(arg);
      //   readPresentations()
      break;

    case 'parent-folder-button':
      gotoParent();
      break;

    case 'upload-script':
      //the button for running the git script
      runUploadScript(message.script);
      break;

    case 'save-script':
      saveUploadScript(message.script);
      break;

    case 'link-to-current-folder':
      revealFinder('', 'folder');
      break;

    case 'save-settings':
      assignSettings(message.settings);
      break;

    case 'download-new-versions':
      sendStatus('Downloading new versions', 'quick');
      downloadViewerFiles('unconditionally');
      break;
    
    case 'display-web-page':
      shell.openExternal(message.url);
      break;

    case 'test-comment-server':
      checkIfCommentServerWorks(message.url);
      break;

  }
});
