import './index.css'

import {
    ipcRenderer
} from 'electron'

import {SlajdomatSettings} from '../main/server'

let settings : SlajdomatSettings;

ipcRenderer.on('settings', (event, msg) => {
    settings = msg as SlajdomatSettings;
    (document.getElementById('port-number') as HTMLInputElement).value = settings.port.toString(); 
    (document.getElementById('ffmpeg-path') as HTMLInputElement).value = settings.ffmpeg; 
    (document.getElementById('ffprobe-path') as HTMLInputElement).value = settings.ffprobe; 
});

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    console.log('clicked')
  if (target.id == 'cancel')
    {
        ipcRenderer.send('settings-closed', undefined);
    }

    if (target.id == 'ok')
    {   
        settings.port = parseInt((document.getElementById('port-number') as HTMLInputElement).value);
        settings.ffmpeg = (document.getElementById('ffmpeg-path') as HTMLInputElement).value;
        settings.ffprobe = (document.getElementById('ffprobe-path') as HTMLInputElement).value;
    
        ipcRenderer.send('settings-closed', settings );
    }
});