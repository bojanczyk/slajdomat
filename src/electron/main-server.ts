export {
    restartServer, startServer
};

    import { exportPdf } from './main-print';

import {
    sendStatus
} from './main';

import {
    MessageToServer,
    ServerResponse
} from '../viewer/types';

import { onGetSlide } from './main-get-slides';
import { createLive, onGetWav } from './main-get-sound';
import { slajdomatSettings } from './main-settings';

import cors from 'cors';
import express from 'express';
import * as http from 'http';




function restartServer() {
    currentServer.close(
        startServer
    )
}


const expressApp = express();
let currentServer: http.Server;

function startServer(): void {


    //this enables the localhost access to work
    expressApp.use(cors())

    expressApp.post('/', function (req, res) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: any[] = [];
        req.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', async () => {
            const msgBody = Buffer.concat(body).toString();
            const msg = JSON.parse(msgBody) as MessageToServer;

            let response: ServerResponse;
            console.log('switching');
            sendStatus(msg.type);
            switch (msg.type) {
                case 'wav':
                    //receives a sound file
                    response = onGetWav(msg);
                    break;

                case 'slides':
                    //receives a presentation
                    response = onGetSlide(msg);
                    break;

                case 'probe':
                    //asks if the server is working
                    response = {
                        status: 'server working'
                    };
                    break

                case 'startLive':
                    response = createLive(msg);
                    break;

                case 'toPdf':
                    response = await exportPdf(msg);
                    break;

                default:
                    throw "unexpected  message type "
            }


            res.send(response);

        });
    })

    currentServer = expressApp.listen(slajdomatSettings.port, () => {
        sendStatus('Server started on port ' + slajdomatSettings.port);
    });
    currentServer.on('error', e => {
        sendStatus(e.message);
        sendStatus('Try changing the port in the Electron/Preferences, and telling the Figma plugin about this.');
    })

}


