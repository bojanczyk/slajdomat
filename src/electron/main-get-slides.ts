/*
this code takes care of recieving slides from the plugin, and saving them to disk
*/

export { onGetSlide };

import * as path from 'path';
import { Manifest } from "../common/types";
import { MessageToServerSlide, ServerResponse } from "../common/messages-viewer-server";
import { sendStatus } from "./main";
import { commentServerPath, readManifest, readPresentations, slideDir, writeFile, writeManifest } from "./main-files";
import { slajdomatSettings } from "./main-settings";
import { version } from "./main-version";
import { copyHTMLFiles } from './main-viewer-files';

//receive the slides from the figma plugin. The slides are copied to the appropriate directory, together with the latest versions of the html code.
function onGetSlide(msg: MessageToServerSlide): ServerResponse {
    sendStatus("Receiving slides for " + msg.presentation);

    const manifest: Manifest = {
        version: version(),
        presentation: msg.presentation,
        slideDict: {},
        tree: msg.tree,
        treeTimeLine: [],
        chronicleTimeLine: []
    }

    try {
        //if there were some sounds previously saved, we keep them
        const oldManifest: Manifest = readManifest(msg.presentation);
        if (oldManifest != undefined) {
            manifest.treeTimeLine = oldManifest.treeTimeLine;
            manifest.chronicleTimeLine = oldManifest.chronicleTimeLine;
            manifest.slideDict = oldManifest.slideDict;


            if (slajdomatSettings.comments) {
                manifest.comments = {
                    server: commentServerPath(msg.presentation),
                    presentation: msg.presentation
                }
                //if there was an old manifest, then maybe there was some nonstandard presentations key for the presentations, in which case we inherit it. The idee is that manifest.comments.presentation is the presentation name by default, but it can diverge
                if (oldManifest.comments != undefined)
                    manifest.comments.presentation = oldManifest.comments.presentation;
            }
        }

        for (const slide of msg.slideList) {
            const dir = slideDir(manifest, slide.database.id, slide.database.name)
            try {
                writeFile(path.join(dir, 'image.svg'), slide.svg);
            } catch (error) {
                throw new Error(`Error writing file ${error.toString()}`);
            }
            sendStatus('Received slides for ' + slide.database.name);
        }
        try {
            writeManifest(manifest);
        }
        catch (error) {
            throw new Error(`Error writing manifest ${error.toString()}`);
        }
        
        copyHTMLFiles(manifest.presentation);
        //reload the presentations in case a new one was added
        readPresentations();

        return {
            status: 'slides received'
        }
    } catch (error) {
        sendStatus(`Error receiving slide ${error.toString()}`);
        return {
            status: 'error', explanation: `${error.toString()}`
        }
    }

}