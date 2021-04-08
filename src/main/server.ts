export {
    startServer,
    slajdomatSettings,
    SlajdomatSettings,
    readPresentations,
    saveSettings,
    loadSettings,
    assignSettings,
    gotoParent,
    gotoChild,
    PresentationListMessage,
    upgradePresentation,
    upgradeAllPresentations,
    revealFinder,
    slideDir
}
import {
    sendStatus,
    mainWindow
} from './index'

import {
    upgradeManifest,
    oldVersion,
    version
} from './server-version'

import {
    freshName,
    sanitize
} from '../common/helper'


import express from 'express'
import cors from 'cors'
import * as http from 'http'
import * as fs from 'fs'
import * as child from 'child_process'
import * as path from 'path'

import {
    app, shell
} from 'electron'

import {
    MessageToServer,
    MessageToServerSound,
    MessageToServerSlide,
    Manifest,
    ServerResponse,
    MessageToServerLive,
    LiveRecording
} from '../viewer/types'




// import { writeFileSync } from 'original-fs'

/*import {
    load
} from 'mime'*/


type PresentationList = {
    [key: string]: { file: string, updated: boolean }
};

//message with list of presentations that is sent to the renderer
type PresentationListMessage = {
    dir: string,
    presentations: PresentationList,
    subfolders: string[],
    atRoot: boolean
}

let currentDir: string;


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

//goes to parent directory
function gotoParent(): void {
    if (currentDir == slajdomatSettings.directory) {
        throw ('cannot go above parent folder');
    }
    else {
        readPresentations(path.join(currentDir, '..'));
    }
}


//goes to child directory
function gotoChild(arg: string): void {
    readPresentations(currentDir + '/' + arg)
}

//shows the folder in the finder
function revealFinder(name: string, type: 'folder' | 'presentation'): void {
    let dir: string;
    if (type == 'presentation')
        dir = presentationDir(name);
    else
        dir = currentDir + '/' + name;
    shell.showItemInFolder(dir);
}

//our choice parameters for stringify
function myStringify(x: PresentationList | Manifest | SlajdomatSettings): string {
    return JSON.stringify(x, null, 2)
}


//returns the directory for a presentation, and if it does not exist, then it creates the directory and adds a suitable entry in the presentations json
function presentationDir(presentationName: string) {
    if (!(presentationName in presentations)) {
        //choose a fresh name based on the presentation name
        const dirName = freshName(sanitize(presentationName), dirList());
        presentations[presentationName] = { file: dirName, updated: true };
        sendStatus('adding ' + dirName)
        fs.mkdirSync(currentDir + '/' + dirName);

    }
    return currentDir + '/' + presentations[presentationName].file;
}

//returns the directory for a slide in a presentation, and if it does not exist, then it creates the directory
function slideDir(manifest: Manifest, slideId: string, name: string = undefined): string {
    const presentation = manifest.presentation;

    if (!(slideId in manifest.slideDict)) {
        let dirName = sanitize(name);

        //get an unused name
        dirName = freshName(dirName, Object.values(manifest.slideDict))


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


function copyHTMLFiles(presentation: string) {
    const presDir = presentationDir(presentation);
    //copy the latest version of the html files to the slide directory
    const htmlSourceDir = app.getAppPath() + '/resources';
    for (const file of ['index.html', 'viewer.js', 'favicon.png', 'slajdomat-logo-blue.svg']) {
        fs.copyFileSync(htmlSourceDir + '/' + file, presDir + '/' + file)
    }
}


//writes the manifest of a presentation to disk
function writeManifest(manifest: Manifest) {
    fs.writeFileSync(presentationDir(manifest.presentation) + '/manifest.json', myStringify(manifest));
}

//reads the manifest of a presentation 
function readManifest(presentation: string): Manifest {
    try {
        const data = fs.readFileSync(presentationDir(presentation) + '/manifest.json').toString();
        const json = JSON.parse(data) as Manifest;
        return json;
    } catch (error) {
        return undefined
    }
}

//upgrades a presentation to the most recent version. This includes upgrading the manifest file.
function upgradePresentation(presentation: string): void {
    const manifest = readManifest(presentation);
    upgradeManifest(manifest);
    writeManifest(manifest);
    copyHTMLFiles(manifest.presentation);
}



//upgrades all presentations in current directory and its descendants
function upgradeAllPresentations(dir = currentDir): void {

    //silently call read presentations and remember its folders and presentation list
    const folders = readPresentations(dir, true);
    const savedPresentations = presentations;

    //upgrade all presentations in the current directory
    for (const pres of Object.keys(presentations))
        upgradePresentation(pres);

    //recursively call for children
    for (const child of folders) {
        upgradeAllPresentations(dir + '/' + child)
    }

    //restore saved values
    currentDir = dir;
    presentations = savedPresentations;

}




//returns all names of directories in the currentDirectory
function dirList(): string[] {
    const retval = [];
    for (const file of fs.readdirSync(currentDir))
        if (fs.lstatSync(currentDir + '/' + file).isDirectory())
            retval.push(file);

    return retval;
}

//scans the present folder for presentations, and sends them the renderer so that buttons can be created
function readPresentations(dir: string = currentDir, silent = false): string[] {

    currentDir = dir;

    const msg: PresentationListMessage = {
        dir: currentDir,
        presentations: {} as PresentationList,
        subfolders: [] as string[],
        atRoot: currentDir == slajdomatSettings.directory
    };

    for (const file of dirList()) {
        const fullName = currentDir + '/' + file;
        try {
            //for each child of the current directory, check if it is a folder with a presentation, and if so, add it to the presentations dictionary
            const data = fs.readFileSync(fullName + '/manifest.json').toString();
            const json = JSON.parse(data) as Manifest;
            msg.presentations[json.presentation] = { file: file, updated: !oldVersion(json) };
        } catch (e) {
            //otherwise, if display as folder, assuming it is not hidden like .git
            if (!file.startsWith('.'))
                msg.subfolders.push(file);
        }

    }


    presentations = msg.presentations;

    if (!silent) {
        //send the list of presentations to the renderer
        mainWindow.webContents.send('presentationList', msg);
    }

    return msg.subfolders;


}


//we get a single sound, in the wav format
function onGetWav(msg: MessageToServerSound): ServerResponse {

    try {
        const manifest = readManifest(msg.presentation);
        const buffer = new Uint8Array(msg.file)
        let fileName: string;
        let live: LiveRecording;

        if (msg.live) {
            live = manifest.live[manifest.live.length - 1];
            fileName = `${presentationDir(msg.presentation)}/${live.dir}/${live.steps.length}`
        }
        else
            fileName = slideDir(manifest, msg.slideId) + '/' + msg.eventId;

        fs.writeFileSync(fileName + '.wav', Buffer.from(buffer));



        if (!fs.existsSync(slajdomatSettings.ffmpeg) || !fs.existsSync(slajdomatSettings.ffprobe))
            throw ('To record sound, install ffmpeg and ffprobe.')

        const retval: ServerResponse = {
            status: 'Sound recorded successfully'
        };


        child.execSync(`${slajdomatSettings.ffmpeg} -y -i  ${fileName}.wav ${fileName}.mp3`);

        fs.unlinkSync(fileName + '.wav');

        let duration: number = undefined;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const probeString = child.execSync(`${slajdomatSettings.ffprobe} -hide_banner -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${fileName}.mp3`);

        duration = parseFloat(probeString.toString());

        if (msg.live)
        {
            //if we are in live mode, then we push the sound onto the list of live steps
            live.steps.push({step : {
                slide : msg.slideId,
                event : msg.eventId,
            }, 
            duration : duration})
        } else
         {
            //otherwise, we file the sound in the sound dictionary. 
            if (!(msg.slideId in manifest.soundDict)) {
                manifest.soundDict[msg.slideId] = {};
            }
            manifest.soundDict[msg.slideId][msg.eventId] = duration;
        }

        writeManifest(manifest);
        sendStatus(`Recorded ${duration.toFixed(2)}s for event ${msg.eventId} in slide ${manifest.slideDict[msg.slideId]}`);

        retval.duration = duration;
        return retval;


    } catch (e) {
        sendStatus(`Failed to record sound for event ${msg.eventId} in slide ${msg.slideId}`);
        sendStatus('Error: ' + e);
        return {
            status: e
        };
    }

}



//receive the slides from the figma plugin. The slides are copied to the appropriate directory, together with the latest versions of the html code.
function onGetSlide(msg: MessageToServerSlide): ServerResponse {
    sendStatus("Receiving slides for " + msg.presentation);

    const manifest: Manifest = {
        version: version(),
        presentation: msg.presentation,
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
            manifest.live = oldManifest.live;
        }


        for (const slide of msg.slideList) {
            const dir = slideDir(manifest, slide.database.id, slide.database.name)
            writeFile(dir + '/image.svg', slide.svg);
            sendStatus('Received slides for ' + slide.database.name);
        }



        writeManifest(manifest);
        copyHTMLFiles(manifest.presentation);






        //reload the presentations in case a new one was added
        readPresentations();

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

//start a live recording. The result is adding a new array of live steps to the manifest.
function createLive(msg: MessageToServerLive): ServerResponse {
    try {
        const manifest: Manifest = readManifest(msg.presentation);
        if (manifest.live == undefined)
            manifest.live = [];

        //create a directory for the liver recording
        const dir = freshName(`live_recording${manifest.live.length}`, dirList());
        fs.mkdirSync(presentationDir(msg.presentation) + '/' + dir);


        manifest.live.push(
            {
                date: Date.now(),
                dir: dir,
                steps: []
            });

        writeManifest(manifest)
        return {
            status: 'ok'
        };
    }
    catch (e) {
        return {
            status: 'error'
        };
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

                case 'startLive':
                    response = createLive(msg);
                    break;

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


