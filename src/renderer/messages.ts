/*
This file describes the communication inteface between the renderer and the main process. So far it has only one direction (from renderer to main), but further reorganisation should cover the other direction.
*/

export { sendMessageToMain, MessageToMain, MessageToRenderer };
import { SlajdomatSettings, PresentationList } from '../main/server'
const { ipcRenderer } = window.require('electron');

type MessageToRenderer = {
    type: 'status-update',
    text: string
} | {
    type: 'stop-spin'
} | {
    type: 'presentation-list',
    dir: string,
    presentations: PresentationList,
    subfolders: string[],
    atRoot: boolean
} 

type MessageToMain = {
    //open the file browser to choose a new presentation folder
    type: 'choose-presentations-folder'
} | {
    //currently not used, will allow to upgrade a presentation to a new version
    type: 'upgrade',
    name: string
} | {
    type: 'reveal-in-finder',
    name: string,
    kind: 'folder' | 'presentation'
} | {
    type: 'open-viewer',
    name: string
} | {
    type: 'goto-folder',
    name: string
} | {
    type: 'parent-folder-button'
} | {
    type: 'git-script'
} | {
    type: 'link-to-current-folder'
} | {
    type: 'settings-closed'
    settings: SlajdomatSettings
}



//the interface for sending a message from the renderer process to the main process. This function is used so that there is a typed message, whose type can be used to see all possible message
function sendMessageToMain(msg: MessageToMain): void {
    ipcRenderer.send('message-to-main', msg);
}

