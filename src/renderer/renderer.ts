import './index.css';

//I would like to use fontsource fonts, but do not know yet how to make this work with stupid webpack
// import '@fontsource/roboto'

// // Below is a replacement of the old import of electron
// // (note that from renderer we must use window.require instead of just require)
// import {
//     ipcRenderer
// } from 'electron'
const { ipcRenderer } = window.require('electron');


import { sendMessageToMain, MessageToMain, MessageToRenderer } from './messages';


ipcRenderer.on('message-to-renderer', (event, arg : MessageToRenderer) => {
    switch (arg.type) {
        case 'stop-spin':
            document.getElementById('spinner').classList.remove('myspinner');
            break;

        case 'status-update':
            const div = document.createElement('div');
            div.innerHTML = arg.text;
            const statusPanel = document.getElementById('messages-list');
            statusPanel.appendChild(div);
            statusPanel.scrollTo(0, statusPanel.scrollHeight);
            break;

        case 'presentation-list':
            receivePresentations(arg);
            break;

    
        default:
            throw('unkown message');
            break;
    }
});






function selectTab(tab : 'presentations' | 'instructions' | 'messages') {
    console.log('selecting',tab);
    for (const tabHead of document.getElementsByClassName('tab-head')) 
    tabHead.classList.remove('selected');

    for (const tabHead of document.getElementsByClassName('main-window-tab')) 
    tabHead.classList.remove('selected');

    document.getElementById(tab+'-head').classList.add('selected');
    document.getElementById(tab+'-tab').classList.add('selected');

}



//we receive the list of presentations in the current folder
function receivePresentations (msg : MessageToRenderer) : void
{
    if (msg.type != 'presentation-list')
        throw('wrong message');
    
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
            sendMessageToMain({ type: 'upgrade', name: name });
        })
        return retval;
    }

    function revealButton(name: string, kind: 'folder' | 'presentation') {
        const retval = document.createElement('i');
        retval.classList.add('material-icons');
        retval.innerHTML = 'folder_open'
        retval.classList.add('toolbar-button');
        retval.addEventListener('click', () => {
            sendMessageToMain({ type: 'reveal-in-finder', name: name, kind: kind });
        })
        return retval;
    }

    //enable/disable the parent folder button depending on whether we are in the root of the current slide directory
    if (msg.atRoot)
        document.getElementById('parent-folder-button').classList.add('disabled')
    else
        document.getElementById('parent-folder-button').classList.remove('disabled');


    document.getElementById('git-script').classList.remove('disabled');
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
                sendMessageToMain({ type: 'open-viewer', name: msg.dir + '/' + msg.presentations[i].file + '/index.html' })
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
                sendMessageToMain({ type: 'goto-folder', name: f });
            })
            ul.appendChild(li);
        }
    }
}

//switch tabs in the main window
document.getElementById('instructions-head').addEventListener('click', (e) => selectTab('instructions'));
document.getElementById('messages-head').addEventListener('click', (e) => selectTab('messages'));
document.getElementById('presentations-head').addEventListener('click', (e) => selectTab('presentations'));


//a button in the toolbar has been clicked
document.getElementById('toolbar').addEventListener('click', (event) => {

    const target = event.target as HTMLElement;
    console.log('here goes');

    if (target.classList.contains('disabled'))
        return;

    switch (target.id) {
        case 'parent-folder-button':
            sendMessageToMain({ type: 'parent-folder-button' });
            break;
        case 'git-script':
            sendMessageToMain({ type: 'git-script' });
            //start the spinner
            document.getElementById('spinner').classList.add('myspinner');
            break;
        case 'link-to-current-folder':
            sendMessageToMain({ type: 'reveal-in-finder', name: '', kind : 'folder' });
            break;

    }

})


document.getElementById('select-folder-button').addEventListener('mouseup', () => {
    sendMessageToMain({ type: 'choose-presentations-folder' });
})



