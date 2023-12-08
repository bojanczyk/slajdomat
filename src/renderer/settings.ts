import './index.css'
const { ipcRenderer } = window.require('electron');

import {SlajdomatSettings} from '../main/server'
import {sendMessageToMain} from './messages'

let settings : SlajdomatSettings;

ipcRenderer.on('settings', (event, msg) => {
    settings = msg as SlajdomatSettings;
    (document.getElementById('port-number') as HTMLInputElement).value = settings.port.toString(); 
    (document.getElementById('ffmpeg-path') as HTMLInputElement).value = settings.ffmpeg; 
    (document.getElementById('ffprobe-path') as HTMLInputElement).value = settings.ffprobe; 
});



document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.id == 'cancel')
    {
        sendMessageToMain({type : 'settings-closed', settings : undefined});
    }

    if (target.id == 'ok')
    {   
        settings.port = parseInt((document.getElementById('port-number') as HTMLInputElement).value);
        settings.ffmpeg = (document.getElementById('ffmpeg-path') as HTMLInputElement).value;
        settings.ffprobe = (document.getElementById('ffprobe-path') as HTMLInputElement).value;
        sendMessageToMain({type : 'settings-closed', settings : settings});
    }

    
});