/* here we manage the viewer files (principally viewer.js and index.html) that are used to display the presentations.
this includes:
- copying viewer files to the presentation directory
- downloading new versions of the viewer files from github
 */


export { copyHTMLFiles, downloadViewerFiles, getResourceDir, setResourceDir, latestViewerVersion };

import { app } from 'electron';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { sendMessageToRenderer, sendStatus } from './main';
import { presentationDir } from './main-files';
import { VersionList } from '../common/types';
import { saveSettings, slajdomatSettings } from './main-settings';
import { save } from 'pdfkit';
import { isLater, theHTMLFiles } from '../common/helper';


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




function copyHTMLFiles(presentation: string) {
    const presDir = presentationDir(presentation);
    for (const file of theHTMLFiles) {
        fs.copyFileSync(path.join(getResourceDir(), file), path.join(presDir, file))
    }
}




// return the best version of the viewer that is compatible with the current app version
// undefined means that the version list is unavailable
async function latestViewerVersion(): Promise<string> {

    const appVersion = app.getVersion();

    const fileUrl = 'https://raw.githubusercontent.com/bojanczyk/slajdomat/master/resources/versions.json';
    // load json from fileUrl
    try {
        const res = await fetch(fileUrl);
        if (!(res.ok))
            throw "not connected";
        else {
            let bestVersion: string = undefined;
            const versionList = (await res.json()) as VersionList;
            for (const candidate of versionList) {
                if (isLater(appVersion, candidate.requiresAppVersion)) {
                    if (slajdomatSettings.viewerVersion == undefined || isLater(candidate.viewerVersion, slajdomatSettings.viewerVersion))
                        bestVersion = candidate.viewerVersion;
                }
            }
            return bestVersion;
        }
    }
    catch (e) {
        return undefined;
    }
}

async function downloadViewerFiles(mode: 'if not there' | 'unconditionally') {

    // check if downloading is necessary
    if (mode == 'if not there') {
        let someMissing = false;
        for (const fileName of theHTMLFiles) {
            const downloadPath = path.join(customViewerDirectory, fileName);
            fs.access(downloadPath, fs.constants.F_OK, (err) => {
                if (err) {
                    someMissing = true;
                    return;
                }
            });
        }
        if (!someMissing)
            return;
    }

    // determine the viewer version that we want to download
    const bestVersion = await latestViewerVersion();
    if (bestVersion == undefined) {
        sendStatus('Could not get the list of viewer versions');
        return;
    }

    let successfulDownloads = 0;
    let failedDownloads = 0;

    // download the files
    for (const fileName of theHTMLFiles) {
        const downloadPath = path.join(customViewerDirectory, fileName);
        sendStatus('Downloading file ' + fileName + ' from version ' + bestVersion);
        const fileUrl = 'https://raw.githubusercontent.com/bojanczyk/slajdomat/master/resources/' + bestVersion + '/' + fileName;

        function failCode() {
            failedDownloads++;
            sendStatus('Failed downloading ' + fileName);
            if (successfulDownloads + failedDownloads == theHTMLFiles.length)
                sendStatus('Failed downloading', 'quick');
        }

        https.get(fileUrl, (response) => {
            // check if the file was found
            if (response.statusCode !== 200)
                failCode();
            else {
                const fileStream = fs.createWriteStream(downloadPath);
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    sendStatus('Successfully downloaded ' + fileName);
                    fileStream.close();
                    successfulDownloads++;
                    if (successfulDownloads + failedDownloads == theHTMLFiles.length) {
                        sendStatus('All files downloaded', 'quick');
                        slajdomatSettings.viewerVersion = bestVersion;
                        saveSettings();
                        sendMessageToRenderer({ type: 'settings', settings: slajdomatSettings, availableVersion : bestVersion });
                    }
                });
            }
        }).on('error', (err) => { failCode(); });
    }
}