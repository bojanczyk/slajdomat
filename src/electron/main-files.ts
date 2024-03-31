/*
this source takes manages the files and directories used by the backend
*/

export {
    PresentationList, commentServerPath, dirList,
    findExecutableInPath, gotoChild, gotoParent, presentationDir, readManifest, readPresentations, revealFinder, slideDir, writeFile, writeManifest
};


import { shell } from "electron";
import * as fs from 'fs';
import * as path from 'path';
import { freshName, toAlphaNumeric } from '../common/helper';
import { Manifest } from "../common/types";
import { sendMessageToRenderer, sendStatus } from "./main";
import { myStringify, slajdomatSettings } from "./main-settings";
import { oldVersion } from "./main-version";
import { ElectronMainToRenderer } from "./messages-main-renderer";



type PresentationList = {
    [key: string]: { file: string, version: 'old' | 'current' }
};


let presentations: PresentationList;

let currentDir: string;








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
        const dirName = freshName(toAlphaNumeric(presentationName), dirList(currentDir));
        presentations[presentationName] = { file: dirName, version: 'current' };
        sendStatus('adding ' + dirName)
        fs.mkdirSync(path.join(currentDir, dirName));

    }
    return path.join(currentDir, presentations[presentationName].file);
}

//returns the directory for a slide in a presentation, and if it does not exist, then it creates the directory
function slideDir(manifest: Manifest, slideId: string, name: string = undefined): string {
    const presentation = manifest.presentation;

    if (!(slideId in manifest.slideDict)) {
        let dirName = toAlphaNumeric(name);
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




//writes the manifest of a presentation to disk
function writeManifest(manifest: Manifest) {
    fs.writeFileSync(path.join(presentationDir(manifest.presentation), 'manifest.json'), myStringify(manifest));
}

//reads the manifest of a presentation 
function readManifest(presentation: string): Manifest {
    try {
        const data = fs.readFileSync(path.join(presentationDir(presentation), 'manifest.json')).toString();
        const json = JSON.parse(data) as Manifest;

        // maybe this code should be part of the upgrading process
        if (json.chronicleTimeLine == undefined)
            json.chronicleTimeLine = [];
        if (json.treeTimeLine == undefined)
            json.treeTimeLine = [];

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
        atRoot: currentDir == slajdomatSettings.directory
    };


    for (const file of dirList(currentDir)) {
        const fullName = path.join(currentDir, file);
        try {
            //for each child of the current directory, check if it is a folder with a presentation, and if so, add it to the presentations dictionary
            const data = fs.readFileSync(path.join(fullName, 'manifest.json')).toString();
            const json = JSON.parse(data) as Manifest;
            msg.presentations[json.presentation] = { file: file, version: oldVersion(json) };
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
