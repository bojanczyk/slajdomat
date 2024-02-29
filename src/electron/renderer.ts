/*
this is code for the electron frontend, called the renderer, as opposed to the backend which is called main. It mainly dispatches events to the backend.
*/


import './electron.css';
export { selectTab, sendElectronRendererToMain };





const { ipcRenderer } = window.require('electron');

import { SlajdomatSettings } from './main-settings';
import { ElectronMainToRenderer, ElectronRendererToMain } from './messages-main-renderer';
import { version as versionNumber } from '../..//package.json';


//icons 
    import '../icons/download.svg';
    import '../icons/folder.svg';
    import '../icons/leftarrow.svg';
    import '../icons/save.svg';
    import '../icons/slideshow.svg';
    import '../icons/upload.svg';
    import '../icons/upload2.svg';
    import '../icons/loading.svg';
    import '../icons/science.svg';
    import '../icons/trending-up.svg';
import { receivePresentations } from './presentations-tab';


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






function selectTab(tab: 'presentations' | 'welcome' | 'messages' | 'upload' | 'settings') {

    const tabHeadContainer = document.querySelector('#tab-heads');
    for (const tabHead of tabHeadContainer.children)
        tabHead.classList.remove('selected');

    const tabContainer = document.querySelector('#tab-contents');
    for (const tabHead of tabContainer.children)
        tabHead.classList.remove('selected');

    document.getElementById(tab + '-head').classList.add('selected');
    document.getElementById(tab + '-tab').classList.add('selected');

}


//switch tabs in the main window


document.getElementById('welcome-head').addEventListener('click', (e) => selectTab('welcome'));
document.getElementById('upload-head').addEventListener('click', (e) => selectTab('upload'));
document.getElementById('presentations-head').addEventListener('click', (e) => selectTab('presentations'));
document.getElementById('messages-head').addEventListener('click', (e) => selectTab('messages'));
document.getElementById('settings-head').addEventListener('click', (e) => selectTab('settings'));



//links to web pages
for (const link of document.querySelectorAll('a')) 
{
    const url = 'https://bojanczyk.github.io/slajdomat/' + link.getAttribute('myref');
    //so far there is only one link, for the user guide 
    link.addEventListener('click' , () =>
    {
            //a link is displayed by the backend, since only the backend has the ability to open a web browser
    sendElectronRendererToMain({type : 'display-web-page',url : url })
    }
    )
}


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

    const versionDiv = document.getElementById('app-version-number') as HTMLDivElement;
    versionDiv.innerText +=' ' +  versionNumber;

    (document.querySelector('#ffmpeg-path') as HTMLInputElement).value = settings.ffmpeg;
    (document.querySelector('#ffprobe-path') as HTMLInputElement).value = settings.ffprobe;
    (document.querySelector('#port-number') as HTMLInputElement).value = settings.port.toString();
    (document.querySelector('#comments-checkbox') as HTMLInputElement).checked = settings.comments;
    (document.querySelector('#comment-url') as HTMLInputElement).value = settings.commentServer;
}



//send back the settings to the main process, so that they can be saved to disk
function sendSettings() {
    const settings: SlajdomatSettings = {
        ffmpeg: (document.querySelector('#ffmpeg-path') as HTMLInputElement).value,
        ffprobe: (document.querySelector('#ffprobe-path') as HTMLInputElement).value,
        port: parseInt((document.querySelector('#port-number') as HTMLInputElement).value),
        comments : (document.querySelector('#comments-checkbox') as HTMLInputElement).checked,
        commentServer : (document.querySelector('#comment-url') as HTMLInputElement).value,
    }
    sendElectronRendererToMain({ 'type': 'save-settings', settings: settings });
}


const commentsCheckbox = document.querySelector('#comments-checkbox') as HTMLInputElement;

commentsCheckbox.addEventListener('click', e => {
    const comments = document.querySelector('#comment-container');
    const commentsField = document.querySelector('#comment-url') as HTMLInputElement; 
    if (commentsCheckbox.checked) 
    {
        comments.classList.remove('disabled');
        commentsField.disabled = false;
    }
    else
    {
        commentsField.disabled = true;
        comments.classList.add('disabled');
    }
        
})


// add a handler for key presses
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'Shift':
            document.getElementById('directory-listing').classList.remove('hide-updates');
            break;
    }
})

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'Shift':
            document.getElementById('directory-listing').classList.add('hide-updates');
            break;
    }
})


