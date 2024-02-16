/*
this source takes manages the files and directories used by the backend
*/

export {
    PresentationList, commentServerPath, copyHTMLFiles, dirList, downloadViewerFiles,
    findExecutableInPath, gotoChild, gotoParent, presentationDir, readManifest, readPresentations, revealFinder, setResourceDir, slideDir, writeFile, writeManifest
};


import { app, shell } from "electron";
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { freshName, sanitize } from '../common/helper';
import { Manifest } from "../common/types";
import { sendMessageToRenderer, sendStatus } from "./main";
import { myStringify, slajdomatSettings } from "./main-settings";
import { oldVersion } from "./main-version";
import { ElectronMainToRenderer } from "./messages-main-renderer";


//these are the files in the resource directory that should be copied to each presentation
const theHTMLFiles = ['index.html', 'viewer.js', 'favicon.png', 'slajdomat-logo-blue.svg'];

type PresentationList = {
    [key: string]: { file: string, updated: boolean }
};


let presentations: PresentationList;

let currentDir: string;






//this is the directory which contains the compiled viewer files, such as viewer.js, that are used to create presentations. By the default it is the 
let customViewerDirectory: string = undefined;

async function downloadViewerFiles(mode: 'if not there' | 'unconditionally') {

    for (const fileName of theHTMLFiles) {
        const downloadPath = path.join(customViewerDirectory, fileName);
        function download() {

            sendStatus('Downloading file ' + fileName);
            const fileUrl = 'https://raw.githubusercontent.com/bojanczyk/slajdomat/master/resources/' + fileName; // Replace with the URL of the file to download
            const fileStream = fs.createWriteStream(downloadPath);
            https.get(fileUrl, (response) => {
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    sendStatus('Successfully downloaded ' + fileName);
                    fileStream.close();
                });
            }).on('error', (err) => {
                sendStatus('Failed downloading ' + err);
            });
        }

        if (mode == 'unconditionally')
            download();
        else
            fs.access(downloadPath, fs.constants.F_OK, (err) => {
                if (err) {
                    download();
                    return;
                }
            });
    }
}

function setResourceDir() {
    customViewerDirectory = app.getPath('userData')

    // the user main pass a custom directory for the viewer files, using the command line argument --viewerdir
    const indexCustomDir = process.argv.indexOf('--viewerdir');
    if (indexCustomDir !== -1 && indexCustomDir < process.argv.length - 1) {
        const customDir = process.argv[indexCustomDir + 1];
        if (customDir != undefined)
            fs.access(customDir, fs.constants.F_OK, (err) => {
                if (err) {
                    sendStatus('Error: could not access directory ' + customDir);
                    return;
                }
                sendStatus('Custom viewer code will be used from' + customDir);
                customViewerDirectory = customDir;
            });
    }

    //checks if a file is there, and if not, downloads it from github
    downloadViewerFiles('if not there');
}

function getResourceDir(): string {
    return customViewerDirectory;
}



//my own implementation of which (actually, chatGPT's), since the npm 'which' package fails when the electron app is run from the Applications folder in macos.

function findExecutableInPath(executableName: string) {
    const paths = process.env.PATH.split(':'); // Split PATH variable into individual paths

    paths.push('/opt/homebrew/bin');
    paths.push('/user/local/bin');

    // Iterate through each path in the PATH variable
    for (const dir of paths) {
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
        try {
            readPresentations(path.join(currentDir, '..'));
        }
        catch (e) {
            sendStatus('Error: you clicked on parent, but the parent directory has been deleted')
        }
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
        dir = path.join(currentDir, name);
    shell.showItemInFolder(dir);
}

//returns the path from a sub-folder to the root folder
function commentServerPath(presentationName: string) {
    const relative = path.relative(presentationDir(presentationName), slajdomatSettings.directory);
    return path.join(relative, slajdomatSettings.commentServer)
}


//returns the directory for a presentation, and if it does not exist, then it creates the directory and adds a suitable entry in the presentations json
function presentationDir(presentationName: string) {
    if (!(presentationName in presentations)) {
        //choose a fresh name based on the presentation name
        const dirName = freshName(sanitize(presentationName), dirList(currentDir));
        presentations[presentationName] = { file: dirName, updated: true };
        sendStatus('adding ' + dirName)
        fs.mkdirSync(path.join(currentDir, dirName));

    }
    return path.join(currentDir, presentations[presentationName].file);
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
            fs.mkdirSync(path.join(presentationDir(presentation), dirName))
        } catch (e) {
            sendStatus(e)
        }
    }

    const dir = path.join(presentationDir(presentation), manifest.slideDict[slideId]);

    //it could be the case that the directory disappeared for some reason, in which case the directory will be created
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir);

    return dir;
}


function copyHTMLFiles(presentation: string) {
    const presDir = presentationDir(presentation);
    for (const file of theHTMLFiles) {
        fs.copyFileSync(path.join(getResourceDir(), file), path.join(presDir, file))
    }
}


//writes the manifest of a presentation to disk
function writeManifest(manifest: Manifest) {
    fs.writeFileSync(path.join(presentationDir(manifest.presentation), 'manifest.json'), myStringify(manifest));
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
        if (fs.lstatSync(path.join(dir, file)).isDirectory())
            retval.push(file);

    return retval;
}

//scans the present folder for presentations, and sends them the renderer so that buttons can be created
function readPresentations(dir: string = currentDir, silent = false): string[] {

    currentDir = dir;

    const msg: ElectronMainToRenderer = {
        type: 'presentation-list',
        dir: currentDir,
        presentations: {} as PresentationList,
        subfolders: [] as string[],
        atRoot: currentDir == slajdomatSettings.directory,
        gitscript: undefined
    };

    try {
        msg.gitscript = fs.readFileSync(path.join(slajdomatSettings.directory, '.gitscript')).toString();
    }
    catch (e) {
        // there is no git script
    }

    for (const file of dirList(currentDir)) {
        const fullName = path.join(currentDir, file);
        try {
            //for each child of the current directory, check if it is a folder with a presentation, and if so, add it to the presentations dictionary
            const data = fs.readFileSync(path.join(fullName, 'manifest.json')).toString();
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
