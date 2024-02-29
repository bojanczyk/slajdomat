/*
this is code for upgrading presentations.
currently it is not in use, since the manifest format seems to be stable
the idea is that each slide manifest is tagged with the version of the Slajdomat package, and if there were some big changes between the current and previous versions, then missing fields should be added to the new manifest.
*/




export { oldVersion, upgradeManifest, upgradePresentation, version};
import { Manifest, Slide, State, StateJSON, TimelineJSON, VersionList } from '../common/types';



import * as child from 'child_process';
import { sendStatus } from './main';
import { readManifest, slideDir, writeManifest } from './main-files';
// import { slideDir, writeManifest, copyHTMLFiles, readManifest, readPresentations } from './server';

import { version as versionNumber } from '../..//package.json';
import { TimeLike } from 'node:original-fs';
import * as path from 'path';
import * as https from 'https';
import { copyHTMLFiles } from './main-viewer-files';

function version(): number {
    return parseFloat(versionNumber);
}

function oldVersion(manifest: Manifest): 'old' | 'current' {
    if (manifest.version != version())
        return 'old';
    else
        return 'current';
}



//upgrades a presentation to the most recent version. This includes upgrading the manifest file.
function upgradePresentation(presentation: string): void {
    console.log('upgrading ' + presentation);
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


//finds a slide based on its id
function findSlide(id: string, manifest: Manifest): Slide {
    function rec(event: Slide): Slide {
        if (event.id == id)
            return event;
        for (const child of event.children)
            if (child.type == 'child') {
                const retval = rec(child);
                if (retval != undefined)
                    return retval;
            }
        return undefined;
    }
    return rec(manifest.tree);
}

type SoundDict = {
    [slide: string]: {
        [eventIndex: string]: number;
    };
};

function soundDictToTimeline(soundDict: SoundDict, manifest: Manifest): TimelineJSON {
    let timeline: TimelineJSON = [];


    for (const slideId of Object.keys(soundDict)) {
        const node = findSlide(slideId, manifest);
        const dir = manifest.slideDict[slideId];

        const events = Object.keys(soundDict[slideId]);
        for (const eventIndex of events) {

            try {
                let index: number;
                if (eventIndex == 'finish')
                    index = node.children.length - 1
                else {
                    // check if eventIndex is a number                            
                    index = parseInt(eventIndex) - 1;
                    if (index >= node.children.length - 1)
                        throw 'index out of range'

                }

                let state: StateJSON;

                if (index == -1)
                    state = { type: 'start', slideId: slideId }
                else
                    state = { type: 'afterEvent', slideId: slideId, eventId: node.children[index].eventId }


                let timelineItem = {
                    state: state,
                    soundFile: path.join(dir, eventIndex + '.mp3'),
                    soundDuration: soundDict[slideId][eventIndex]
                }

                timeline.push(timelineItem);
            }
            catch (e) {
                console.log('out of range', slideId, eventIndex);
            }

        }
    }
    return timeline;
}


function upgradeManifest(manifest: Manifest): void {

    if (manifest.version == version())
        return;

    const soundDict = (manifest as any).soundDict as SoundDict;
    if (soundDict != undefined)
        manifest.treeTimeLine = soundDictToTimeline(soundDict, manifest);

    sendStatus('Upgraded ' + manifest.presentation)
    manifest.version = version();

}



