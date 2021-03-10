import './index.css'

import {
    ipcRenderer
} from 'electron'

import {SlajdomatSettings} from '../main/server'

let settings : SlajdomatSettings;

ipcRenderer.on('settings', (event, msg) => {
    settings = msg as SlajdomatSettings;
    const portInput = document.getElementById('port-number') as HTMLInputElement;
    portInput.value = msg.port 
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
        const portInput = document.getElementById('port-number') as HTMLInputElement;
        settings.port = parseInt(portInput.value);
        ipcRenderer.send('settings-closed', settings );
    }
});