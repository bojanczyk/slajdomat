/* modify the settings of the plugin on the backend */
export { getLatexSettings, initSettings, pluginSettings, sendSettings };

import { selChange, sendToUI } from "./code";
import { LatexPluginSettings } from "./plugin-types";
import { upgradeVersion } from "./plugin-version";




//the plugin settings
let pluginSettings: LatexPluginSettings;




//get the settings from the ui
function getLatexSettings(settings: LatexPluginSettings): void {
    pluginSettings = settings;
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
function initSettings() {
    upgradeVersion();
    figma.clientStorage.getAsync('slajdomat').then(
        x => {
            //the default plugin settings
            const defaultSettings = {
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
                    ...JSON.parse(x)
                };
            } catch (e) {
                pluginSettings = defaultSettings;
            }
            sendSettings();
            selChange();
        }
    )
}

