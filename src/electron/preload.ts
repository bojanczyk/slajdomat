// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, ElectronMainToRenderer, ElectronRendererToMain } from './messages-main-renderer';

const electronAPI: ElectronAPI = {
    send: (msg: ElectronRendererToMain): void => {
        ipcRenderer.send('message-to-main', msg);
    },
    onMessage: (callback: (msg: ElectronMainToRenderer) => void): void => {
        ipcRenderer.on('message-to-renderer', (_event, msg: ElectronMainToRenderer) => callback(msg));
    },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
