export {onGetSlide}

import { Manifest, MessageToServerSlide, ServerResponse } from "../viewer/types";
import { sendStatus } from "./main";
import { copyHTMLFiles, readManifest, readPresentations, slideDir, version, writeFile, writeManifest } from "./main-files";
import * as path from 'path';

//receive the slides from the figma plugin. The slides are copied to the appropriate directory, together with the latest versions of the html code.
function onGetSlide(msg: MessageToServerSlide): ServerResponse {
    sendStatus("Receiving slides for " + msg.presentation);

    const manifest: Manifest = {
        version: version(),
        presentation: msg.presentation,
        slideDict: {},
        tree: msg.tree,
        soundDict: {}
    }

    try {
        //if there were some sounds previously saved, we keep them
        const oldManifest: Manifest = readManifest(msg.presentation);
        if (oldManifest != undefined) {
            manifest.soundDict = oldManifest.soundDict;
            manifest.slideDict = oldManifest.slideDict;
            manifest.live = oldManifest.live;
        }

        for (const slide of msg.slideList) {
            const dir = slideDir(manifest, slide.database.id, slide.database.name)
            writeFile(path.join(dir, 'image.svg'), slide.svg);
            sendStatus('Received slides for ' + slide.database.name);
        }
        writeManifest(manifest);
        copyHTMLFiles(manifest.presentation);
        //reload the presentations in case a new one was added
        readPresentations();

        return {
            status: 'slides received'
        }
    } catch (error) {
        sendStatus(`Error receiving slide ${error.toString()}`);
        return {
            status: 'error', explanation: `Error receiving slide ${error.toString()}`
        }
    }

}