export {
    startServer,
    slajdomatSettings,
    SlajdomatSettings,
    readPresentations,
    saveSettings,
    loadSettings,
    assignSettings
}
import {
    sendStatus,
    mainWindow
} from './index'

import express from 'express'
import cors from 'cors'
import * as http from 'http'
import * as fs from 'fs'
import * as child from 'child_process'

import {
    app
} from 'electron'

import {
    MessageToServer,
    MessageToServerSound,
    Manifest,
    SlideEvent,
    ServerResponse
} from '../viewer/types'

import {
    Database
} from '../plugin/plugin-types'

/*import {
    load
} from 'mime'*/


type PresentationList = {
    [key: string]: string
};

type SlajdomatSettings = {
    port: number,
    directory ? : string
}

let presentations: PresentationList;

let slajdomatSettings: SlajdomatSettings;

// let localDir: string = undefined;



function resourceDir(): string {
    return app.getAppPath() + '/resources'
}

function loadSettings(): void {
    const data = fs.readFileSync(resourceDir() + '/settings.json').toString();
    slajdomatSettings = JSON.parse(data) as SlajdomatSettings;
}

function saveSettings(): void {
    writeFile(resourceDir() + '/settings.json', myStringify(slajdomatSettings));
}

//I use this function, because the variable slajdomatSettings is read-only outside this module
function assignSettings(arg: SlajdomatSettings): void {
    if (slajdomatSettings.port != arg.port) {
        //the port has been changed, so we restart the server
        currentServer.close(
            startServer
        )
    }
    slajdomatSettings = arg;
    saveSettings();
}

//writes the file in the local directory
function writeFile(fileName: string, fileContents: string | Buffer) {
    fs.writeFile(fileName, fileContents, function (err) {
        if (err) throw err;
        // sendStatus(fileName + ' written.');
    });
}

//our choice parameters for stringify
function myStringify(x: PresentationList | Manifest | SlajdomatSettings): string {
    return JSON.stringify(x, null, 2)
}

//sanitize a string so that it is a good filename 
function sanitize(s: string) {
    return encodeURI(s).replace(/:/g, "_").replace(/%20/g, '_').replace(/%/g, '#');
}

//returns the directory for a presentation, and if it does not exist, then it creates the directory and adds a suitable entry in the presentations json
function presentationDir(presentationName: string) {
    if (!(presentationName in presentations)) {
        const dirName = sanitize(presentationName)
        presentations[presentationName] = dirName;
        sendStatus('adding ' + dirName)
        mainWindow.webContents.send('presentationList', presentations);
        fs.mkdirSync(slajdomatSettings.directory + '/' + dirName)
    }
    return slajdomatSettings.directory + '/' + presentations[presentationName];
}

//returns the directory for a slide in a presentation, and if it does not exist, then it creates the directory
function slideDir(manifest: Manifest, slideId: string, name: string = undefined): string {
    const presentation = manifest.presentation;

    if (!(slideId in manifest.slideDict)) {
        const dirName = sanitize(name);
        manifest.slideDict[slideId] = dirName;
        writeManifest(manifest);
        sendStatus('Received slide ' + dirName);
        try {
            fs.mkdirSync(presentationDir(presentation) + '/' + dirName)
        } catch (e) {
            sendStatus(e)
        }
    }
    return presentationDir(presentation) + '/' + manifest.slideDict[slideId]
}

//writes the manifest of a presentation to disk
function writeManifest(manifest: Manifest) {
    writeFile(presentationDir(manifest.presentation) + '/manifest.json', myStringify(manifest));
}

//reads the manifest of a presentation 
function readManifest(presentation: string) {
    try {
        const data = fs.readFileSync(presentationDir(presentation) + '/manifest.json').toString();
        const json = JSON.parse(data) as Manifest;
        return json;
    } catch (error) {
        return undefined
    }
}


function readPresentations(): void {
    //returns the title of a presentation stored in the given directory, otherwise throws an error (for example, if the argument is not a directory, or a directory without a manifest)
    function presentationTitle(dir: string): string {
        const data = fs.readFileSync(slajdomatSettings.directory + '/' + dir + '/manifest.json').toString();
        // console.log(data);
        const json = JSON.parse(data) as Manifest;
        return json.presentation;
    }

    presentations = {};
    //for each child of the presentations directory, check if it is a folder with a presentation, and if so, add it to the presentations dictionary
    fs.readdirSync(slajdomatSettings.directory).forEach(file => {
        try {
            const title = presentationTitle(file);
            presentations[title] = file;
        } catch (e) {
            // do nothing
        }
    })

    //send the list of presentations to the renderer
    mainWindow.webContents.send('presentationList', {
        dir: slajdomatSettings.directory,
        presentations: presentations
    });

}


//we get a single sound, in the wav format
function onGetWav(msg: MessageToServerSound): ServerResponse {

    const manifest = readManifest(msg.presentation);
    const buffer = new Uint8Array(msg.file)
    const fileName = slideDir(manifest, msg.slideId) + '/' + msg.name;
    writeFile(fileName + '.wav', Buffer.from(buffer));

    //create a new entry in the sound dictionary 
    if (!(msg.slideId in manifest.soundDict)) {
        manifest.soundDict[msg.slideId] = {};
    }

    const retval: ServerResponse = {
        status: 'Sound recorded successfully'
    };


    child.exec(resourceDir() + '/ffmpeg -y -i ' + fileName + '.wav ' + fileName + '.mp3', (error) => {
        if (error) {
            sendStatus(`ffmpeg command failed: ${error.message}`);
            return;
        }
        let duration: number = undefined;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        child.exec(resourceDir() + '/ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ' + fileName + '.mp3', (error, stdout, ignoredBis) => {
            if (error) {
                sendStatus(`ffprobe for checking duration failed: ${error.message}`);
                return;
            }
            duration = parseFloat(stdout);
            manifest.soundDict[msg.slideId][msg.index] = {
                file: msg.name,
                duration: duration
            };
            writeManifest(manifest);
            sendStatus('Sound for event ' + msg.index + ' in slide ' + manifest.slideDict[msg.slideId]);
            sendStatus('Sound duration: ' + stdout);

            retval.duration = duration;
        })

    });

    return retval;
}



//receive the slides from the figma plugin. The slides are copied to the appropriate directory, together with the latest versions of the html code.
function onGetSlide(msg: {
    type: 'slides',
    presentation: string,
    tree: SlideEvent,
    slideList: {
        database: Database,
        svg: string
    } []
}): ServerResponse {
    sendStatus("Receiving slides for " + msg.presentation);

    const manifest: Manifest = {
        presentation: msg.presentation,
        root: msg.slideList[0].database.id,
        slideDict: {},
        tree: msg.tree,
        soundDict: {}
    }

    //if there were some sounds previously saved, we keep them
    const oldManifest: Manifest = readManifest(msg.presentation);
    if (oldManifest != undefined) {
        manifest.soundDict = oldManifest.soundDict;
        manifest.slideDict = oldManifest.slideDict;
    }


    for (const slide of msg.slideList) {
        const dir = slideDir(manifest, slide.database.id, slide.database.name)
        writeFile(dir + '/image.svg', slide.svg);
        sendStatus('Received slides for ' + slide.database.name);
    }

    const presDir = presentationDir(manifest.presentation)

    writeFile(presDir + '/manifest.json', myStringify(manifest));

    //copy the latest version of the html files to the slide directory
    const htmlSourceDir = app.getAppPath() + '/resources';
    fs.copyFileSync(htmlSourceDir + '/index.html', presDir + '/index.html')
    fs.copyFileSync(htmlSourceDir + '/viewer.js', presDir + '/viewer.js')

    return {
        status: "ok"
    }

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
        }).on('end', () => {
            const msgBody = Buffer.concat(body).toString();
            const msg = JSON.parse(msgBody) as MessageToServer;

            let response: ServerResponse;
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
                        status: 'ok'
                    };
                    break

                default:
                    throw "unexpected message type "
            }

            res.send(response);

        });
    })

    // for some reason that I do not understand, if I choose 3000 instead of 3001, I get EADDRINUSE. Also, I do not know how to catch such an error, try/catch does not work. Also, the above app.on does not work.
    currentServer = expressApp.listen(slajdomatSettings.port, () => {
        sendStatus('Server started on port ' + slajdomatSettings.port);
    });
    currentServer.on('error', e => {
        sendStatus(e.message);
        sendStatus('Try changing the port in the Electron/Preferences, and telling the Figma plugin about this.');
    })

}