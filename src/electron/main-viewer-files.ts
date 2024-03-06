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
import axios from 'axios';
import { promisify } from 'util';
import { pipeline as callbackPipeline } from 'stream';
import { DownloadViewerResult } from './messages-main-renderer';


//this is the directory which contains the compiled viewer files, such as viewer.js, that are used to create presentations. By the default it is the 
let customViewerDirectory: string = undefined;



function setResourceDir() {
    customViewerDirectory = app.getPath('userData')
}

function getResourceDir(): string {
    return customViewerDirectory;
}




function copyHTMLFiles(presentation: string) {
    const presDir = presentationDir(presentation);
    for (const file of theHTMLFiles) {
        const source = path.join(getResourceDir(), file);
        // check if source exists 
        if (!fs.existsSync(source)) {
            throw new Error('The Slajdomat app is missing the viewer files. See its settings.');
        }
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



async function downloadViewerFiles(mode: 'if not there' | 'unconditionally'): Promise<DownloadViewerResult> {

    // check if some viewer files are missing
    let someMissing = false;
    for (const fileName of theHTMLFiles) {
        const downloadPath = path.join(customViewerDirectory, fileName);
        if (!fs.existsSync(downloadPath))
            someMissing = true;
    }

    // check if downloading is necessary
    if (mode == 'if not there') {
        if (!someMissing)
            return 'did nothing';
    }

    // determine the viewer version that we want to download
    const bestVersion = await latestViewerVersion();
    if (bestVersion == undefined) {
        sendStatus('Could not get the list of viewer versions');
        if (someMissing)
            return 'critical failure'
        else
            return 'failure';
    }


    // download the files
    for (const fileName of theHTMLFiles) {
        const downloadPath = path.join(customViewerDirectory, fileName);
        sendStatus('Downloading file ' + fileName + ' from version ' + bestVersion);
        const fileUrl = 'https://raw.githubusercontent.com/bojanczyk/slajdomat/master/resources/' + bestVersion + '/' + fileName;

        try {
            const response = await axios({
                url: fileUrl,
                method: 'GET',
                responseType: 'stream'
            });


            if (response.status !== 200) {
                sendStatus('Failed downloading ' + fileName);
                throw new Error('Failed downloading ' + fileName);
            }

            const pipeline = promisify(callbackPipeline);
            await pipeline(response.data, fs.createWriteStream(downloadPath));

            sendStatus('Successfully downloaded ' + fileName);

        } catch (error) {
            sendStatus('Failed downloading viewer files', 'quick');
            if (someMissing)
                return 'critical failure'
            else
                return 'failure';
        }


    }
    slajdomatSettings.viewerVersion = bestVersion;
    saveSettings();
    sendStatus('Viewer files downloaded at version ' + bestVersion, 'quick');
    sendMessageToRenderer({ type: 'settings', settings: slajdomatSettings, availableVersion: bestVersion, problemWithViewerFiles : false });
    return 'success'
}