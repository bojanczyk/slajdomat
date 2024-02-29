/* here we manage the viewer files (principally viewer.js and index.html) that are used to display the presentations.
this includes:
- copying viewer files to the presentation directory
- downloading new versions of the viewer files from github
 */


export { copyHTMLFiles, downloadViewerFiles, getResourceDir, setResourceDir };

import { app } from 'electron';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { sendStatus } from './main';
import { presentationDir } from './main-files';

//this is the directory which contains the compiled viewer files, such as viewer.js, that are used to create presentations. By the default it is the 
let customViewerDirectory: string = undefined;



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



//these are the files in the resource directory that should be copied to each presentation
const theHTMLFiles = ['index.html', 'viewer.js', 'favicon.png', 'slajdomat-logo-blue.svg'];


function copyHTMLFiles(presentation: string) {
    const presDir = presentationDir(presentation);
    for (const file of theHTMLFiles) {
        fs.copyFileSync(path.join(getResourceDir(), file), path.join(presDir, file))
    }
}

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