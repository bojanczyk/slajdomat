export { upgradeManifest, oldVersion, version }
import { Manifest, ZoomEvent } from '../viewer/types'


import { version as versionNumber } from '../..//package.json';
import { sendStatus } from '.';
import * as child from 'child_process'
import { slideDir } from './server';



function version(): number {
    return parseFloat(versionNumber);
}

function oldVersion(manifest: Manifest): boolean {
    return manifest.version != version();
}

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