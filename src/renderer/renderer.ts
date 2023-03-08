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

// // Below is a replacement of the old import of electron
// // (note that from renderer we must use window.require instead of just require)
// import {
//     ipcRenderer
// } from 'electron'
const { ipcRenderer } = window.require( 'electron' );



import {
    PresentationListMessage
} from '../main/server'



//print a message at the status update at the bottom
ipcRenderer.on('status-update', (event, arg) => {
    const div = document.createElement('div');
    div.innerHTML = arg;
    const statusPanel = document.getElementById('status-panel');
    statusPanel.appendChild(div);
    statusPanel.scrollTo(0, statusPanel.scrollHeight);
})

//stop the spinner for a toolbar element
ipcRenderer.on('stop-spin', (event, arg) => {
    if (arg == 'git-script') {
        const buttonHTML = document.getElementById('git-script');
        buttonHTML.innerHTML = 'file_upload';
        buttonHTML.classList.remove('myspinner');
    }

})







//we receive the list of presentations in the current folder
ipcRenderer.on('presentationList', (event, msg: PresentationListMessage) => {

    // console.log("Received presentations: ", msg);

    function nameDiv(type: 'folder' | 'presentation', name: string) {
        const retval = document.createElement('div');
        retval.classList.add('presentation-name');
        retval.innerHTML = `<i class="material-icons"> ${type == 'folder' ? 'folder_open' : 'zoom_out_map'} </i> ${name}`;

        return retval;
    }

    function updateButton(name: string) {
        const retval = document.createElement('i');
        retval.classList.add('material-icons');
        retval.innerHTML = 'trending_up';
        retval.classList.add('toolbar-button');
        retval.addEventListener('click', () => {
            ipcRenderer.send('upgrade', name)
        })
        return retval;
    }

    function revealButton(name: string, type: 'folder' | 'presentation') {
        const retval = document.createElement('i');
        retval.classList.add('material-icons');
        retval.innerHTML = 'folder_open'
        retval.classList.add('toolbar-button');
        retval.addEventListener('click', () => {
            ipcRenderer.send('reveal-finder', { type: type, name: name })
        })
        return retval;
    }

    //show or hide the parent folder button depending on whether we are in the root of the current slide directory
    document.getElementById('parent-folder').style.display = (msg.atRoot ? 'none' : '')


    document.getElementById('folder-link').innerHTML = msg.dir;
    document.getElementById('presentation-panel').classList.remove('hidden');
    document.getElementById('no-pre').classList.add('hidden');
    const ul = document.getElementById("all-presentations");
    ul.innerHTML = '';

    //is there at least one presentation that can be upgraded
    let canUpgrade = false;

    if (Object.keys(msg.presentations).length == 0 && msg.subfolders.length == 0) {
        //if there are no presentations in the current directory, then a message is displayed which says that such presentations can be created using the figma plugin
        document.getElementById('empty-folder-text').classList.remove('hidden');
    } else {

        //if there are presentations in the current directory, then they are shown
        document.getElementById('empty-folder-text').classList.add('hidden');
        for (const i of Object.keys(msg.presentations)) {

            const li = document.createElement("div");
            li.classList.add('presentation-line');
            const name = nameDiv('presentation', i);
            li.appendChild(name)
            name.addEventListener('click', () => {
                ipcRenderer.send('open-viewer', msg.dir + '/' + msg.presentations[i].file + '/index.html')
            })
            li.appendChild(revealButton(i, 'presentation'));
            if (!msg.presentations[i].updated) {
                li.appendChild(updateButton(i));
                canUpgrade = true;
            }
            ul.appendChild(li);
        }


        for (const f of msg.subfolders) {
            console.log(f);
            const li = document.createElement("div");
            li.classList.add('presentation-line')
            const name = nameDiv('folder', f);
            li.appendChild(name);
            name.addEventListener('click', () => {
                ipcRenderer.send('goto-folder', f)
            })
            ul.appendChild(li);
        }
    }
    canUpgrade = true;
    const upgradeButton = document.getElementById('upgrade-presentations') as HTMLElement;
    if (canUpgrade) { upgradeButton.style.display = '' }
    else { upgradeButton.style.display = 'none' }

});


document.getElementById('parent-folder').addEventListener('click', () => {
    ipcRenderer.send('parent-folder');
})

document.getElementById('toolbar').addEventListener('click', (event) => {

    const button = (event.target as HTMLElement).id;
    ipcRenderer.send('toolbar', button);

    //for toolbar buttons that take more time, we do a spinner
    if (button == 'git-script') {
        const buttonHTML = document.getElementById('git-script');
        buttonHTML.innerHTML = 'autorenew';
        buttonHTML.classList.add('myspinner');
    }


})



