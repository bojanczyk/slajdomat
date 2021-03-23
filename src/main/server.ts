export {
    startServer,
    slajdomatSettings,
    SlajdomatSettings,
    readPresentations,
    saveSettings,
    loadSettings,
    assignSettings,
    currentDir
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
// import { writeFileSync } from 'original-fs'

/*import {
    load
} from 'mime'*/


type PresentationList = {
    [key: string]: string
};


let currentDir : string;


type SlajdomatSettings = {
    port: number,
    directory?: string,
    ffmpeg: string,
    ffprobe: string
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
    return encodeURI(s).replace(/:/g, "_").replace(/%20/g, '_').replace(/%/g, '_');
}

//returns the directory for a presentation, and if it does not exist, then it creates the directory and adds a suitable entry in the presentations json
function presentationDir(presentationName: string) {
    if (!(presentationName in presentations)) {
        const dirName = sanitize(presentationName);
        sendStatus('adding ' + dirName)
        fs.mkdirSync(currentDir + '/' + dirName)
    }
    return currentDir + '/' + presentations[presentationName];
}

//returns the directory for a slide in a presentation, and if it does not exist, then it creates the directory
function slideDir(manifest: Manifest, slideId: string, name: string = undefined): string {
    const presentation = manifest.presentation;

    if (!(slideId in manifest.slideDict)) {
        let dirName = sanitize(name);

        //append a number to the dir name until it is not used
        while (Object.values(manifest.slideDict).indexOf(dirName) > -1) {
            dirName = dirName + 'bis';
        }


        manifest.slideDict[slideId] = dirName;
        writeManifest(manifest);
        sendStatus('Received slide ' + dirName);
        try {
            fs.mkdirSync(presentationDir(presentation) + '/' + dirName)
        } catch (e) {
            sendStatus(e)
        }
    }

    const dir = presentationDir(presentation) + '/' + manifest.slideDict[slideId];

    //it could be the case that the directory disappeared for some reason, in which case the directory will be created
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir);

    return dir;
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



//scans the present folder for presentations, and sends them the renderer so that buttons can be created
function readPresentations(where : string): void {

    currentDir = where;
    
    function scanFolders(dir: string) {

        const retval = {
            dir : dir,
            presentations:  {} as PresentationList,
            subfolders : [] as string[]
        }        
        fs.readdirSync(dir).forEach(file => {
            const fullName = dir + '/' + file;
            try {
                //for each child of the current directory, check if it is a folder with a presentation, and if so, add it to the presentations dictionary
                const data = fs.readFileSync(fullName + '/manifest.json').toString();
                const json = JSON.parse(data) as Manifest;
                retval.presentations[json.presentation] = file;
                console.log('added ', file);
            } catch (e) {
                //otherwise, if the file is not a folder with presentations, then run recursively
                if (!file.startsWith('.')) {
                    if (fs.lstatSync(fullName).isDirectory())
                        retval.subfolders.push(file);
                }
            }

        })
        return retval;
    }

    const msg = scanFolders(currentDir);
    

    //send the list of presentations to the renderer
    mainWindow.webContents.send('presentationList', msg);
    

}


//we get a single sound, in the wav format
function onGetWav(msg: MessageToServerSound): ServerResponse {

    try {
        const manifest = readManifest(msg.presentation);
        const buffer = new Uint8Array(msg.file)
        const fileName = slideDir(manifest, msg.slideId) + '/' + msg.name;
        fs.writeFileSync(fileName + '.wav', Buffer.from(buffer));

        //create a new entry in the sound dictionary 
        if (!(msg.slideId in manifest.soundDict)) {
            manifest.soundDict[msg.slideId] = {};
        }

        if (!fs.existsSync(slajdomatSettings.ffmpeg) || !fs.existsSync(slajdomatSettings.ffprobe))
            throw ('To record sound, install ffmpeg and ffprobe.')

        const retval: ServerResponse = {
            status: 'Sound recorded successfully'
        };


        child.execSync(`${slajdomatSettings.ffmpeg} -y -i  ${fileName}.wav ${fileName}.mp3`);

        //delete the .wav version, which is no longer needed
        // fs.unlinkSync(fileName + '.wav');

        let duration: number = undefined;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const probeString = child.execSync(`${slajdomatSettings.ffprobe} -hide_banner -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${fileName}.mp3`);

        duration = parseFloat(probeString.toString());
        manifest.soundDict[msg.slideId][msg.index] = {
            file: msg.name,
            duration: duration
        };
        writeManifest(manifest);
        sendStatus(`Recorded ${duration.toFixed(2)}s for event ${msg.index} in slide ${manifest.slideDict[msg.slideId]}`);

        retval.duration = duration;
        return retval;


    } catch (e) {
        sendStatus(`Failed to record sound for event ${msg.index} in slide ${msg.slideId}`);
        sendStatus('Error: ' + e);
        return {
            status: e
        };
    }

}



//receive the slides from the figma plugin. The slides are copied to the appropriate directory, together with the latest versions of the html code.
function onGetSlide(msg: {
    type: 'slides',
    presentation: string,
    tree: SlideEvent,
    slideList: {
        database: Database,
        svg: string
    }[]
}): ServerResponse {
    sendStatus("Receiving slides for " + msg.presentation);

    const manifest: Manifest = {
        presentation: msg.presentation,
        root: msg.slideList[0].database.id,
        slideDict: {},
        tree: msg.tree,
        soundDict: {}
    }

    try {
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
    } catch (error) {
        sendStatus(`Error receiving slide ${error.toString}`);
        return {
            status: 'error'
        }
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