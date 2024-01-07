/*
This file describes the communication inteface between the renderer and the main process. 
*/

export { ElectronRendererToMain, ElectronMainToRenderer};
import { PresentationList } from './main-files'
import { SlajdomatSettings } from './main-settings';

const { ipcRenderer } = window.require('electron');


//messages from electron main to electron renderer
type ElectronMainToRenderer = { 
    type: 'status-update',
    subtype : 'quick' | 'log' | 'upload',
    text: string
} | {
    type: 'stop-spin'
} | {
    type: 'presentation-list',
    dir: string,
    presentations: PresentationList,
    subfolders: string[],
    atRoot: boolean,
    gitscript : string
} | {
    type: 'settings',
    settings : SlajdomatSettings
}

//messages from electron renderer to electron main
type ElectronRendererToMain = {
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
    dir : string,
    file : string
} | {
    type: 'goto-folder',
    name: string
} | {
    type: 'parent-folder-button'
} | {
    type: 'upload-script',
    script : string
} | {
    type: 'save-script',
    script : string
} | {
    type: 'link-to-current-folder'
} | {
    type: 'save-settings',
    settings : SlajdomatSettings
} | {
    type: 'download-new-versions'
} | {
    type: 'display-web-page',
    url : string
} | {
    type: 'test-comment-server',
    url : string
} 



