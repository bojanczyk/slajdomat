import { VersionList } from '../common/types';
import { version as versionNumber } from '../../package.json';
import * as fs from 'fs';
import * as versionsJSON from '../../resources/versions.json';
import { isLater, theHTMLFiles } from '../common/helper';


// read the file to json

let versions: VersionList = undefined;
const versionsFile = './resources/versions.json';

fs.readFile(versionsFile, 'utf8', (err, data) => {
    if (err) {
        console.error('An error occurred:', err);
        return;
    }

    try {
        versions = JSON.parse(data);

        let maxVersion: string = undefined;
        for (const old of versions) {
            if (maxVersion == undefined || isLater(old.viewerVersion, maxVersion))
                maxVersion = old.viewerVersion;
        }

        if (isLater(versionNumber, maxVersion))
            maxVersion = versionNumber;

        console.log('The latest version is', maxVersion);

        const numList = maxVersion.split('.').map(x => parseInt(x));
        numList[2] = numList[2] + 1;
        const newVersion = numList.join('.');

        // we assume that the required app version is x.0.0 where x is the major version of package.json
        numList[2] = 0;
        numList[1] = 0;
        const appVersion = numList.join('.');
        
        console.log('The new version is', newVersion);

        // set the package.json version to the new version
        const packageJsonFile = './package.json';
        fs.readFile(packageJsonFile, 'utf8', (err, data) => {
            if (err) {
                console.error('An error occurred:', err);
                return;
            }

            try {
                const packageJson = JSON.parse(data);
                packageJson.version = newVersion;
                fs.writeFile(packageJsonFile, JSON.stringify(packageJson, null, 2), (err) => {
                    if (err) {
                        console.error('An error occurred writing to package.json', err);
                        return;
                    }
                });
            } catch (err) {
                console.error('Error parsing JSON:', err);
            }
        });

        // copy the viewer files to the resources directory
        const viewerFiles = './resources';

        // make a directory for the new version
        const newVersionDir = viewerFiles + '/' + newVersion;
        fs.mkdir(newVersionDir, (err) => {
            if (err) {
                console.error('An error occurred making directory for' + newVersionDir + err);
                return;
            }
        });

        // copy the files from test slides to the new version
        const testSlides = './test-slides';

        for (const file of theHTMLFiles) {
            fs.copyFileSync(testSlides + '/' + file, newVersionDir + '/' + file)
        }

        // update the versions.json file
        versions.push({ viewerVersion: newVersion, requiresAppVersion: appVersion });
        fs.writeFile(versionsFile, JSON.stringify(versions, null, 2), (err) => {
            if (err) {
                console.error('An error occurred writing versions.json:', err);
                return;
            }
        });





    } catch (err) {
        console.error('Error parsing JSON:', err);
    }
});

