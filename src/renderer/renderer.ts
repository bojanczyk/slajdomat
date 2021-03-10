/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

//I would like to use fontsource fonts, but do not know yet how to make this work with stupid webpack
// import '@fontsource/roboto'

import {
    ipcRenderer
} from 'electron'





ipcRenderer.on('status-update', (event, arg) => {
    const div = document.createElement('div');
    div.innerHTML = arg;
    const statusPanel = document.getElementById('status-panel');
    statusPanel.appendChild(div);
    statusPanel.scrollTo(0,statusPanel.scrollHeight);
})

ipcRenderer.on('presentationList', (event, msg) => {
    document.getElementById('folder-link').innerHTML = msg.dir;
    document.getElementById('presentation-panel').classList.remove('hidden');
    document.getElementById('no-pre').classList.add('hidden');
    const ul = document.getElementById("all-presentations");
    ul.innerHTML = '';
    if (Object.keys(msg.presentations).length == 0) {
        //if there are no presentations in the current directory, then a message is displayed which says that such presentations can be created using the figma plugin
        document.getElementById('empty-folder-text').classList.remove('hidden');
    } else {
        //if there are presentations in the current directory, then they are shown
        document.getElementById('empty-folder-text').classList.add('hidden');
        for (const i of Object.keys(msg.presentations)) {

            const li = document.createElement("div");
            li.classList.add('presentation')
            li.id = i;
            li.innerHTML = i;
            li.addEventListener('click', () => {
                ipcRenderer.send('open-viewer', msg.presentations[i])
            })
            ul.appendChild(li);
        }
    }
});


document.getElementById('folder-link').addEventListener('click', () => {
    console.log('')
})