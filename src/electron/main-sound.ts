


import fs from 'fs';
import {  ServerResponse, StateJSON } from '../viewer/types';
import { readManifest, slideDir } from './main-files';
import path from 'path';
import { sendStatus } from './main';


/*
// a message from the server to start recording sound for a new state
function recordSound(msg: MessageToServerNewSound): ServerResponse {
    const manifest = readManifest(msg.presentation);
    let soundName;
    if (msg.state.event.type == 'afterEvent')
        soundName = 'after-' + msg.state.event.eventId + '.wav'
    else
        soundName = 'start.wav';


    const pathName = path.join(slideDir(manifest, msg.state.slideId, soundName));
    const fileName = path.join(pathName, soundName);
    console.log('writing file ' + fileName);
    // const audioBuffer = Buffer.from(msg.audio, 'base64');
    fs.writeFileSync(fileName, msg.audio, { encoding: 'base64' });
  

    // fs.writeFileSync(fileName, Buffer.from(msg.audio, 'base64'));
    // sendStatus('wrote file ' + fileName, 'log');
    return { status: 'sound recorded' };
}

*/