export { upgradeManifest, oldVersion, version,upgradePresentation }
import { Manifest, ZoomEvent } from '../viewer/types'


import { version as versionNumber } from '../..//package.json';
import { sendStatus } from './';
import * as child from 'child_process'
import { slideDir, writeManifest, copyHTMLFiles, readManifest, readPresentations } from './server';


//this file contains code for upgrading presentations 
//the idea is that each slide manifest is tagged with the version of the Slajdomat package, and if there were some big changes between the current and previous versions, then missing fields should be added to the new manifest.

function version(): number {
    return parseFloat(versionNumber);
}

function oldVersion(manifest: Manifest): boolean {
    return manifest.version != version();
}


//upgrades a presentation to the most recent version. This includes upgrading the manifest file.
function upgradePresentation(presentation: string): void {
    const manifest = readManifest(presentation);
    upgradeManifest(manifest);
    writeManifest(manifest);
    copyHTMLFiles(manifest.presentation);
}


/*
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
*/


function upgradeManifest(manifest: Manifest): void {

    
    if (manifest.version == version())
        return;

    if (manifest.version < 0.89) {
        console.log('nothing')

        //add keywords to all slides
        // eslint-disable-next-line no-inner-declarations
        function eventIdAdd(event: ZoomEvent) {
            for (let i = 0; i < event.children.length; i++) {
                const child = event.children[i];
                child.eventId = i.toString();
                if (child.type == 'child')
                    eventIdAdd(child);
            }
        }

        eventIdAdd(manifest.tree);
        manifest.tree.eventId = 'root';

    }

    if (manifest.version < 0.902) {
        for (const slide of Object.keys(manifest.soundDict)) {
            const dict = manifest.soundDict[slide]
            const events = Object.keys(dict);
            for (const event of events)
                dict[event] = (dict[event] as any).duration;

            const oldKey = (events.length - 1).toString();
            dict['finish'] = dict[oldKey];
            delete dict[oldKey];
            const dir = slideDir(manifest, slide);
            try {child.execSync(`mv ${dir}/${oldKey}.mp3 ${dir}/finish.mp3 `);}
            catch (e) {console.log('failed to copy file',e)}
        }
    }






    sendStatus('Upgraded ' + manifest.presentation)
    manifest.version = version();

}