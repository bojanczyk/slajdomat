/* modify the settings of the plugin on the backend */
export { getLatexSettings, initSettings, pluginSettings, sendSettings };

import { selChange, sendToUI } from "./code";
import { deleteTree, drawTree } from "./code-draw-tree";
import { LatexPluginSettings } from "./plugin-types";
import { upgradeVersion } from "./plugin-version";




//the plugin settings
let pluginSettings: LatexPluginSettings;




//get the settings from the ui
function getLatexSettings(settings: LatexPluginSettings): void {
    let oldDrawTree = pluginSettings.drawTree;
    pluginSettings = settings;
    if (oldDrawTree !== settings.drawTree) {
        if (settings.drawTree)
            drawTree()
        else
            deleteTree();
    }
    figma.clientStorage.setAsync('slajdomat', JSON.stringify(settings));
    sendSettings();
}

//send the settings to the ui
function sendSettings(): void {
    sendToUI({
        type: 'settings',
        settings: pluginSettings
    });
}



//initialize the settings for the plugin
async function initSettings() {


    upgradeVersion();
    const stored = await figma.clientStorage.getAsync('slajdomat');

    //the default plugin settings
    const defaultSettings = {
        drawTree: true,
        words: ['∀', '∃', '∧', '∨', '∈'],
        active: false,
        mathFont: {
            family: 'STIXGeneral',
            style: 'Regular'
        },
        mathFontSize: 1,
        serverURL: 'http://localhost:3001',
        latexitURL: 'https://latex.codecogs.com/svg.latex?'
    }

    try {
        pluginSettings = {
            ...defaultSettings,
            ...JSON.parse(stored)
        };
    } catch (e) {
        pluginSettings = defaultSettings;
    }
    sendSettings();
    selChange();


}

