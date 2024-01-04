import './index.css';
export { selectTab }





const { ipcRenderer } = window.require('electron');
import * as path from 'path'

import { ElectronRendererToMain, ElectronMainToRenderer } from './messages-main-renderer';
import { SlajdomatSettings } from './server';
export { sendElectronRendererToMain };


//icons 
import '../icons/save.svg';
import '../icons/download.svg';
import '../icons/leftarrow.svg';
import '../icons/folder.svg';
import '../icons/slideshow.svg';
import '../icons/upload.svg';


//the interface for sending a message from the renderer process to the main process. This function is used so that there is a typed message, whose type can be used to see all possible message
function sendElectronRendererToMain(msg: ElectronRendererToMain): void {
    ipcRenderer.send('message-to-main', msg);
}


//there are two logs, one for the uploads, and one for other things
function statusUpdate(text: string, subtype: 'quick' | 'log' | 'upload') {

    switch (subtype) {

        //the type types git and log use  scrolling log windows
        case 'upload':
        case 'log':
            const div = document.createElement('div');
            div.innerHTML = text;
            let statusPanel;
        
            if (subtype == 'log')
                statusPanel = document.getElementById('general-status');
            else
                statusPanel = document.getElementById('upload-status');
        
            statusPanel.appendChild(div);
            statusPanel.scrollTo(0, statusPanel.scrollHeight);
            break;

        //this pops up some text at the bottom of the screen for a 5 seconds
        case 'quick':
            const quickStatus : HTMLElement = document.querySelector('#quick-status');
            quickStatus.innerHTML = text;
            quickStatus.style.opacity = '1';
            setTimeout(() => {quickStatus.style.opacity = '0';}, 2500);
            break;

    }

}

//message handler, for messages that come from Electron Main
ipcRenderer.on('message-to-renderer', (event, arg: ElectronMainToRenderer) => {
    switch (arg.type) {
        case 'stop-spin':
            document.getElementById('spinner').classList.remove('myspinner');
            break;

        case 'status-update':
            statusUpdate(arg.text, arg.subtype);
            break;

        case 'presentation-list':
            receivePresentations(arg);
            break;

        case 'settings':
            displaySettings(arg.settings);
            break;

        default:
            throw ('unkown message');
            break;
    }
});






function selectTab(tab: 'presentations' | 'instructions' | 'messages' | 'upload' | 'settings') {
    for (const tabHead of document.getElementsByClassName('tab-head'))
        tabHead.classList.remove('selected');

    for (const tabHead of document.getElementsByClassName('main-window-tab'))
        tabHead.classList.remove('selected');

    document.getElementById(tab + '-head').classList.add('selected');
    document.getElementById(tab + '-tab').classList.add('selected');

}



//we receive the list of presentations in the current folder
function receivePresentations(msg: ElectronMainToRenderer): void {
    if (msg.type != 'presentation-list')
        throw ('wrong message');

    if (msg.gitscript != undefined) {
        (document.querySelector('#upload-script-text') as HTMLTextAreaElement).value = msg.gitscript;
    }

    function nameDiv(type: 'folder' | 'presentation', name: string) {
        const retval = document.createElement('div');
        retval.classList.add('presentation-name');
        retval.innerHTML = `
        <span class="toolbar-button"> <img src="${type == 'folder' ? '../src/icons/folder.svg' : '../src/icons/slideshow.svg'}"></span>${name}`;

        return retval;
    }

    function updateButton(name: string) {
        const retval = document.createElement('i');
        retval.classList.add('material-icons');
        retval.innerHTML = 'trending_up';
        retval.classList.add('toolbar-button');
        retval.addEventListener('click', () => {
            sendElectronRendererToMain({ type: 'upgrade', name: name });
        })
        return retval;
    }

    function revealButton(name: string, kind: 'folder' | 'presentation') {
        const retval = document.createElement('div');
        retval.innerHTML = `
        <span class="toolbar-button"> <img src="../src/icons/folder.svg"></span>`;
        retval.addEventListener('click', () => {
            sendElectronRendererToMain({ type: 'reveal-in-finder', name: name, kind: kind });
        })
        return retval;
    }

    //enable/disable the parent folder button depending on whether we are in the root of the current slide directory
    if (msg.atRoot)
        document.getElementById('parent-folder-button').classList.add('disabled')
    else
        document.getElementById('parent-folder-button').classList.remove('disabled');


    document.getElementById('upload-script-button').classList.remove('disabled');
    document.getElementById('link-to-current-folder').innerHTML = msg.dir;
    selectTab('presentations');


    //hide the text which says that there is no presentations folder selected
    document.getElementById('no-presentations-text').classList.add('hidden');

    //this is where the list of subfolders or presentations will be given
    const ul = document.getElementById("directory-listing");
    ul.innerHTML = '';



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
                sendElectronRendererToMain({ type: 'open-viewer', dir : msg.dir, file :  msg.presentations[i].file })
            })
            li.appendChild(revealButton(i, 'presentation'));
            if (!msg.presentations[i].updated) {
                //here there could be code for upgrading presentations, which is not currently used
                // li.appendChild(updateButton(i));
                // canUpgrade = true;
            }
            ul.appendChild(li);
        }


        for (const f of msg.subfolders) {
            const li = document.createElement("div");
            li.classList.add('presentation-line')
            const name = nameDiv('folder', f);
            li.appendChild(name);
            name.addEventListener('click', () => {
                sendElectronRendererToMain({ type: 'goto-folder', name: f });
            })
            ul.appendChild(li);
        }
    }
}

//switch tabs in the main window


document.getElementById('instructions-head').addEventListener('click', (e) => selectTab('instructions'));
document.getElementById('upload-head').addEventListener('click', (e) => selectTab('upload'));
document.getElementById('presentations-head').addEventListener('click', (e) => selectTab('presentations'));
document.getElementById('messages-head').addEventListener('click', (e) => selectTab('messages'));
document.getElementById('settings-head').addEventListener('click', (e) => selectTab('settings'));



//a button in the toolbar has been clicked
for (const button of document.querySelectorAll('.toolbar-button'))
    button.addEventListener('click', () => {
        if (button.classList.contains('disabled'))
            return;

        const script = (document.querySelector('#upload-script-text') as HTMLTextAreaElement).value;
        switch (button.id) {
            case 'parent-folder-button':
                sendElectronRendererToMain({ type: 'parent-folder-button' });
                break;
            case 'upload-script-button':
                sendElectronRendererToMain({ type: 'upload-script', script: script });
                //start the spinner
                document.getElementById('spinner').classList.add('myspinner');
                break;
            case 'link-to-current-folder':
                sendElectronRendererToMain({ type: 'reveal-in-finder', name: '', kind: 'folder' });
                break;
            case 'save-script':
                sendElectronRendererToMain({ type: 'save-script', script: script });
                break;
            case 'save-settings':
                sendSettings();
                break;
            case 'download-new-viewer':
                sendElectronRendererToMain({ type: 'download-new-versions' });
                break;
        }
    })



document.getElementById('select-folder-button').addEventListener('mouseup', () => {
    sendElectronRendererToMain({ type: 'choose-presentations-folder' });
})


//display the settings in the forms in the settings tab
function displaySettings(settings: SlajdomatSettings) {
    (document.querySelector('#ffmpeg-path') as HTMLInputElement).value = settings.ffmpeg;
    (document.querySelector('#ffprobe-path') as HTMLInputElement).value = settings.ffprobe;
    (document.querySelector('#port-number') as HTMLInputElement).value = settings.port.toString();
}



//send back the settings to the main process, so that they can be saved to disk
function sendSettings() {
    const settings: SlajdomatSettings = {
        ffmpeg: (document.querySelector('#ffmpeg-path') as HTMLInputElement).value,
        ffprobe: (document.querySelector('#ffprobe-path') as HTMLInputElement).value,
        port: parseInt((document.querySelector('#port-number') as HTMLInputElement).value)
    }
    sendElectronRendererToMain({ 'type': 'save-settings', settings: settings });
}

