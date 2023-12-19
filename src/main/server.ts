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
    revealFinder,
    slideDir,
    writeManifest,
    readManifest,
    copyHTMLFiles,
    PresentationList
}
import {
    sendStatus,
    mainWindow,
    sendMessageToRenderer
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
import * as child from 'child_process'

import * as fs from 'fs'
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

import {
    MessageToRenderer,
} from '../renderer/messages'






type PresentationList = {
    [key: string]: { file: string, updated: boolean }
};

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
    
    return path.join(app.getAppPath(), 'resources');
}



//my own implementation of which (actually, chatGPT's), since the npm 'which' package fails when the electron app is run from the Applications folder in macos.

function findExecutableInPath(executableName: string) {
    const paths = process.env.PATH.split(':'); // Split PATH variable into individual paths

    paths.push('/opt/homebrew/bin');

    // Iterate through each path in the PATH variable
    for (const dir of paths) {
        sendStatus(dir);
        const fullPath = path.join(dir, executableName);

        try {
            // Check if the file exists and is executable
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && stat.mode & fs.constants.S_IXUSR) {
                return fullPath; // Return the path to the executable
            }
        } catch (err) {
            // Ignore errors and continue searching
            continue;
        }
    }
    return ''; // Executable not found
}

function loadSettings(): Boolean {

    try {
        const data = fs.readFileSync(path.join(resourceDir(),'settings.json')).toString();
        slajdomatSettings = JSON.parse(data) as SlajdomatSettings;


        if (slajdomatSettings.ffmpeg == '')
            slajdomatSettings.ffmpeg = findExecutableInPath('ffmpeg');

        if (slajdomatSettings.ffprobe == '')
            slajdomatSettings.ffprobe = findExecutableInPath('ffprobe');

        return true;
    }
    catch (err) {
        return false;
    }

}

function saveSettings(): void {
    writeFile(path.join(resourceDir(),'settings.json'), myStringify(slajdomatSettings));
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
    fs.writeFile(fileName, fileContents, function (err: any) {
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
    readPresentations(path.join(currentDir, arg))
}

//shows the folder in the finder
function revealFinder(name: string, type: 'folder' | 'presentation'): void {
    let dir: string;
    if (type == 'presentation')
        dir = presentationDir(name);
    else
        dir = path.join(currentDir,name);
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
        const dirName = freshName(sanitize(presentationName), dirList(currentDir));
        presentations[presentationName] = { file: dirName, updated: true };
        sendStatus('adding ' + dirName)
        fs.mkdirSync(path.join(currentDir,dirName));

    }
    return path.join(currentDir,presentations[presentationName].file);
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
            fs.mkdirSync(path.join(presentationDir(presentation),dirName))
        } catch (e) {
            sendStatus(e)
        }
    }

    const dir = path.join(presentationDir(presentation),manifest.slideDict[slideId]);

    //it could be the case that the directory disappeared for some reason, in which case the directory will be created
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir);

    return dir;
}


function copyHTMLFiles(presentation: string) {
    const presDir = presentationDir(presentation);
    //copy the latest version of the html files to the slide directory
    const htmlSourceDir = path.join(app.getAppPath(),'resources');
    for (const file of ['index.html', 'viewer.js', 'favicon.png', 'slajdomat-logo-blue.svg']) {
        fs.copyFileSync(path.join(htmlSourceDir,file), path.join(presDir,file))
    }
}


//writes the manifest of a presentation to disk
function writeManifest(manifest: Manifest) {
    fs.writeFileSync(path.join(presentationDir(manifest.presentation),'manifest.json'), myStringify(manifest));
}

//reads the manifest of a presentation 
function readManifest(presentation: string): Manifest {
    try {
        const data = fs.readFileSync(path.join(presentationDir(presentation), 'manifest.json')).toString();
        const json = JSON.parse(data) as Manifest;
        return json;
    } catch (error) {
        return undefined
    }
}





//returns all names of directories in the currentDirectory
function dirList(dir: string): string[] {
    const retval = [];
    for (const file of fs.readdirSync(dir))
        if (fs.lstatSync(path.join(dir,file)).isDirectory())
            retval.push(file);

    return retval;
}

//scans the present folder for presentations, and sends them the renderer so that buttons can be created
function readPresentations(dir: string = currentDir, silent = false): string[] {

    currentDir = dir;

    const msg: MessageToRenderer = {
        type: 'presentation-list',
        dir: currentDir,
        presentations: {} as PresentationList,
        subfolders: [] as string[],
        atRoot: currentDir == slajdomatSettings.directory
    };

    for (const file of dirList(currentDir)) {
        const fullName = path.join(currentDir,file);
        try {
            //for each child of the current directory, check if it is a folder with a presentation, and if so, add it to the presentations dictionary
            const data = fs.readFileSync(path.join(fullName,'manifest.json')).toString();
            const json = JSON.parse(data) as Manifest;
            msg.presentations[json.presentation] = { file: file, updated: !oldVersion(json) };
        } catch (e) {
            //otherwise, if display as folder, assuming it is not hidden like .git
            if (!file.startsWith('.'))
                msg.subfolders.push(file);
        }

    }


    presentations = msg.presentations; // can be removed?

    if (!silent) {
        sendMessageToRenderer(msg);
    }

    return msg.subfolders;


}


//we get a single sound, in the wav format
function onGetWav(msg: MessageToServerSound): ServerResponse {
    let soundDescription: string;


    try {

        const manifest = readManifest(msg.presentation);
        const buffer = new Uint8Array(msg.file)
        let fileName: string;
        let live: LiveRecording;

        if (msg.forWhat.type != 'event') {
            live = manifest.live[manifest.live.length - 1];
            fileName = `${presentationDir(msg.presentation)}/${live.dir}/${live.steps.length}`;
            soundDescription = ` current step in the live recording`;
        }
        else {
            fileName = path.join(slideDir(manifest, msg.forWhat.slideId), msg.forWhat.eventId);
            soundDescription = `for event ${msg.forWhat.eventId} in slide ${manifest.slideDict[msg.forWhat.slideId]}`;
        }

        fs.writeFileSync(fileName + '.wav', Buffer.from(buffer));


        let ffmpeg = slajdomatSettings.ffmpeg;
        if (ffmpeg == '') ffmpeg = 'ffmpeg';
        let ffprobe = slajdomatSettings.ffprobe;
        if (ffprobe == '') ffprobe = 'ffprobe';


        const retval: ServerResponse = {
            status: 'Sound recorded successfully'
        };


        try {
            child.execSync(`${slajdomatSettings.ffmpeg} -y -i  ${fileName}.wav ${fileName}.mp3`);
        }
        catch (e) { throw 'Failed to run ffmpeg' }



        fs.unlinkSync(fileName + '.wav');


        let duration: number = undefined;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const probeString = child.execSync(`${slajdomatSettings.ffprobe} -hide_banner -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${fileName}.mp3`);
            duration = parseFloat(probeString.toString());
        } catch (e) { throw 'Failed to run ffprobe' }



        if (msg.forWhat.type != 'event') {
            //if we are in live mode, then we push the sound onto the list of live steps
            live.steps.push({
                step: msg.forWhat.description,
                duration: duration
            })
        } else {
            //otherwise, we file the sound in the sound dictionary. 
            if (!(msg.forWhat.slideId in manifest.soundDict)) {
                manifest.soundDict[msg.forWhat.slideId] = {};
            }
            manifest.soundDict[msg.forWhat.slideId][msg.forWhat.eventId] = duration;
        }

        writeManifest(manifest);
        sendStatus(`Recorded ${duration.toFixed(2)}s for ${soundDescription}`);

        retval.duration = duration;
        return retval;


    } catch (e) {
        sendStatus(`Failed to record sound for ${soundDescription}`);
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
            writeFile(path.join(dir,'image.svg'), slide.svg);
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
        sendStatus(`Error receiving slide ${error.toString()}`);
        return {
            status: 'error'
        }
    }

}

//start a live recording. The result is adding a new array of live steps to the manifest.
function createLive(msg: MessageToServerLive): ServerResponse {
    try {
        sendStatus('going live')
        const manifest: Manifest = readManifest(msg.presentation);
        if (manifest.live == undefined)
            manifest.live = [];


        //create a directory for the liver recording
        const dir = freshName(`live_recording${manifest.live.length}`, dirList(presentationDir(msg.presentation)));
        fs.mkdirSync(path.join(presentationDir(msg.presentation),dir));


        manifest.live.push(
            {
                date: (new Date()).toString(),
                dir: dir,
                steps: []
            });

        sendStatus('has been pushed')

        writeManifest(manifest)
        return {
            status: 'ok'
        };
    }
    catch (e) {
        sendStatus(e)
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
                    throw "unexpected  message type "
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


