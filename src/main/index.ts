import { app, BrowserWindow, ipcMain, dialog} from 'electron';
import { createMenu } from './menubar'
import * as child from 'child_process'

// import * as fs from 'fs'
const fs = require('fs');


import { startServer, slajdomatSettings, readPresentations, saveSettings, loadSettings, assignSettings, gotoChild, gotoParent, upgradePresentation, upgradeAllPresentations,revealFinder } from './server'

export { sendStatus, mainWindow, openPreferences, openFolder }

//this is the link to the main window html, produced by the despicable webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_WEBPACK_ENTRY: string;

//the main window with the presentation list 
let mainWindow = null as BrowserWindow;



function sendStatus(text: string): void {
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
ipcMain.on('open-viewer', (event, arg) => {
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

  viewerWin.loadFile(arg)
  viewerWin.once('ready-to-show', () => {
    viewerWin.show()

    // Open the DevTools.
    //viewerWin.webContents.openDevTools();
  })
})


//the user has clicked on a folder name
ipcMain.on('goto-folder', (event, arg) => {
  gotoChild(arg);
})

//the user has clicked on the button for the parent folder
ipcMain.on('parent-folder', () => { gotoParent() })

//the user has clicked on the button for the parent folder
ipcMain.on('upgrade', (event, arg) => {
  upgradePresentation(arg);
  readPresentations()
}
)




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
      mainWindow.webContents.send('stop-spin', 'git-script');
    });
  }
}

//a button in the toolbar has been clicked
ipcMain.on('toolbar', (event, arg) => {
  switch (arg) {

    case 'git-script':
      //the button for running the git script
      runGitScript();
      break;


    case 'upgrade-presentations':
      upgradeAllPresentations();
      readPresentations();
      break;

    default:
    //do nothing

  }
})

ipcMain.on('reveal-finder', (event,arg) => {
  revealFinder(arg.name, arg.type);      
});



//the menu item for choosing a presentation directory
function openFolder(): Promise<void> {
  return dialog.showOpenDialog({ properties: ['openDirectory'] }).then(
    result => {
      if (!result.canceled) {
        //console.log('not cancelled')
        slajdomatSettings.directory = result.filePaths[0];
        readPresentations(slajdomatSettings.directory);
        saveSettings();
      }
    }
  );
}


let preferencesWindow: BrowserWindow;
//open the preferences, which for the moment only uses the port number
function openPreferences(): void {
  // console.log('preferences')
  preferencesWindow = new BrowserWindow({
    height: 250,
    width: 300,
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

//the preferences window was closed, either through ok or cancel
ipcMain.on('settings-closed', (event, arg) => {
  if (arg != undefined) {
    //the settings window was not  cancelled
    assignSettings(arg);
  }
  preferencesWindow.close();
})

function startApp(): void {
  loadSettings();
  if (fs.existsSync(slajdomatSettings.directory) &&
    fs.lstatSync(slajdomatSettings.directory).isDirectory()) {
    readPresentations(slajdomatSettings.directory);
  }

  startServer();
}