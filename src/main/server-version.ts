export {upgradeManifest, oldVersion, version}
import {Manifest, SlideEvent} from '../viewer/types'


import { version as versionNumber } from '../..//package.json';
import { sendStatus } from '.';

function version() : number {
    return parseFloat(versionNumber);
}

function oldVersion(manifest: Manifest) : boolean {
    return manifest.version != version();
}


function upgradeManifest( manifest : Manifest) : void {

    if (manifest.version == version())
        return;

    if (manifest.version < 0.84) 
    {
        //add keywords to all slides
        // eslint-disable-next-line no-inner-declarations
        function keywordsAdd(event : SlideEvent) {
            event.keywords = [event.name];
            if (event.children == undefined)
                event.children = [];
            for (const child of event.children)
                keywordsAdd(child);
            }
        
        keywordsAdd(manifest.tree);
    }

    sendStatus('Upgraded '+ manifest.presentation)
    manifest.version = version();

}