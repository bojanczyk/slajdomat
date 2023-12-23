import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { createMenu } from './menubar'
import * as child from 'child_process'

import * as fs from 'fs'
import * as path from 'path'

import { startServer, slajdomatSettings, readPresentations, saveSettings, loadSettings, assignSettings, gotoChild, gotoParent, revealFinder, SlajdomatSettings } from './server'
import {MessageToMain, MessageToRenderer} from '../renderer/messages';


export { sendStatus, mainWindow, openPreferences, choosePresentationsFolder, sendMessageToRenderer }





//this is the link to the main window html, produced by the despicable webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_WEBPACK_ENTRY: string;

//the main window with the presentation list 
let mainWindow = null as BrowserWindow;



function sendStatus(text: string): void {
  sendMessageToRenderer({type : 'status-update', text : text});
}


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {
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

//the event handler for messages from the renderer process
ipcMain.on('message-to-main', (event, arg) => {
  const message = arg as MessageToMain;

  switch (message.type) {
    case 'choose-presentations-folder':
      choosePresentationsFolder();
      break;

    case 'reveal-in-finder':
      revealFinder(message.name, message.kind);
      break;

    case 'open-viewer':
      openViewer(message.name);
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

    case 'git-script':
      //the button for running the git script
      runGitScript();
      break;

    case 'link-to-current-folder':
      revealFinder('', 'folder');
      break;

    case 'settings-closed':
      if (message.settings != undefined) {
        //the settings window was not  cancelled
        assignSettings(message.settings);
      }
      preferencesWindow.close();
      break;



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


  viewerWin.loadFile(path.join(name,'index.html'));
  viewerWin.once('ready-to-show', () => {
    viewerWin.show();
    viewerWin.webContents.executeJavaScript("window.runFromApp('"+name+"')");

    // Open the DevTools.
    //viewerWin.webContents.openDevTools();
  })
}




//the interface for sending a message from the renderer process to the main process. This function is used so that there is a typed message, whose type can be used to see all possible message
function sendMessageToRenderer(msg: MessageToRenderer): void {
  mainWindow.webContents.send('message-to-renderer', msg);
}


function runGitScript(): void {
  const gitScript = slajdomatSettings.directory + '/.gitscript';
  if (!fs.existsSync(gitScript)) {
    sendStatus('There is no file .gitscript in ' + slajdomatSettings.directory)
  }
  else {
    const gitProcess = child.spawn('bash', ['.gitscript'], { cwd: slajdomatSettings.directory });

    gitProcess.stdout.on('data', function (data) {
      if (data != null)
        sendStatus(data.toString());
    });

    gitProcess.stderr.on('data', function (data) {
      if (data != null)
        sendStatus(data.toString());
    });

    gitProcess.on('exit', function (code) {
      if (code == 0)
        sendStatus('Git script successful.')
      else
        sendStatus('Git script failed.')
      
      sendMessageToRenderer({type : 'stop-spin'});
    });
  }
}



//the menu item for choosing a presentation directory
function choosePresentationsFolder(): Promise<void> {

  return dialog.showOpenDialog({ properties: ['openDirectory'] }).then(
    result => {
      if (!result.canceled) {
        slajdomatSettings.directory = result.filePaths[0];
        readPresentations(slajdomatSettings.directory);
        saveSettings();
      }
    }
  );
}


//the preferences window
let preferencesWindow: BrowserWindow;

//open the preferences, which for the moment only uses the port number
function openPreferences(): void {

  preferencesWindow = new BrowserWindow({
    height: 450,
    width: 350,
    // modal : true // I would like to understand how to do this
    //parent : mainWindow,
    frame: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      // for modern versions of electron the following is also needed to enable interprocess communication
      // (otherwise one should use contextBridge)
      contextIsolation: false,
    }
  });

  // and load the index.html of the app.
  preferencesWindow.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY);
  preferencesWindow.once('ready-to-show', () => {
    preferencesWindow.show()
  })
  preferencesWindow.webContents.on('did-finish-load', () => {
    preferencesWindow.webContents.send('settings', slajdomatSettings)
  });
}



function startApp(): void {

  if (loadSettings()) {
    if (fs.existsSync(slajdomatSettings.directory) &&
      fs.lstatSync(slajdomatSettings.directory).isDirectory()) {
      readPresentations(slajdomatSettings.directory);
    }
    startServer();
  }
  else {
    dialog.showMessageBox({
      type: 'info',
      title: 'Alert',
      message: 'Could not access the settings file. It should be inside the app, buried in a directory ending with resources/settings.json. If you are a developer, this probably means that there was an issue when running the script post-electron.sh.',
      buttons: ['Too bad, I will quit now.'],
    });
  }



}