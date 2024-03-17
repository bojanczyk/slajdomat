
export {
    matematykData,
    latexitOne,
    latexitTwo,
    matematykWord,
    matReplacer
}

import {
    LatexitData,
} from './plugin-types'

import {
    pluginSettings,
    sendSettings
} from './code-settings'
import { load } from 'webfontloader';
import { capsDict, latexDict } from './latex-dict';


// functions for matematyk **************
//inserts the word in the font STIXGeneral
let latexitSelection: SceneNode;





//the first stage of latexit, when we find the object to be latexed
function latexitOne(): void {
    if (figma.currentPage.selection.length > 0) {
        latexitSelection = figma.currentPage.selection[0];
        const data = matematykData(latexitSelection);

        if (latexitSelection.type == 'TEXT') {
            let text = encodeURIComponent((latexitSelection as TextNode).characters);
            text = text.replace('%E2%80%99%20', "'");
            const url = pluginSettings.latexitURL + text;
            figma.ui.postMessage({
                type: 'fetchlatex',
                url: url
            });


        } else
            if (data != null) {
                const text = figma.createText();
                latexitSelection.parent.appendChild(text);
                console.log(data.font);
                figma.loadFontAsync(data.font).then(() => {
                    try {
                        text.name = latexitSelection.name;
                        text.fontName = data.font;
                        text.characters = data.code;
                        text.fontSize = data.fontsize;
                        text.x = latexitSelection.x;
                        text.y = latexitSelection.y;
                        latexitSelection.remove();
                        figma.currentPage.selection = [text];
                    } catch (error) {
                        console.log(error);
                        figma.notify("Could not delatex.");
                    }
                })
            }
    }
}

//function returns the matematyk data for a node
function matematykData(node: SceneNode): LatexitData {
    try {
        const str = node.getPluginData('matematyk');
        return JSON.parse(str)
    } catch (e) {
        return null;
    }
}

//the second state of latexit, when we got the svg
function latexitTwo(svg: string): void {
    const node = figma.createNodeFromSvg(svg);

    //if we got here, then we know that the selection was text, and will be turned to svg
    const original = latexitSelection as TextNode;

    const parent = figma.currentPage.selection[0].parent;
    parent.appendChild(node);

    const font = original.getRangeFontName(0, 1) as FontName;

    const latexData: LatexitData = {
        fontsize: original.getRangeFontSize(0, 1) as number,
        code: original.characters,
        font: font
    }
    node.setPluginData("matematyk", JSON.stringify(latexData));

    node.name = latexData.code;
    node.rescale(latexData.fontsize * 0.065);
    node.x = latexitSelection.x;
    node.y = latexitSelection.y;

    latexitSelection.remove();
    figma.currentPage.selection = [node];

}

//inserts the word w after the caret, 
function matematykWord(addedString: string): void {

    //figma requires me to load lots of fonts before changing anything in the text field
    function loadFonts(node: TextNode): Promise<void[]> {
        const len = node.characters.length;
        const fontArray = [figma.loadFontAsync(pluginSettings.mathFont)];

        if (typeof node.fontName != 'symbol') //there is more than one font
        {
            fontArray.push(figma.loadFontAsync(node.fontName))
        } else {
            for (let i = 0; i < len; i++) {
                fontArray.push(figma.loadFontAsync(node.getRangeFontName(i, i + 1) as FontName))
            }
        }
        return Promise.all(fontArray);
    }

    //the added string should be at the front of the cache, so if it is present in the cache, then we delete it
    const index = pluginSettings.words.indexOf(addedString)
    if (index != -1) // if it is in the cache
        pluginSettings.words.splice(index, 1);
    pluginSettings.words.push(addedString);
    sendSettings();
    figma.clientStorage.setAsync('slajdomat', JSON.stringify(pluginSettings));


    //add the word after the selected range 
    const range = figma.currentPage.selectedTextRange;
    if (range != null) {
        loadFonts(range.node).then(() => {
            range.node.insertCharacters(range.start, addedString + " ");
            const size = range.node.getRangeFontSize(range.start, range.start + 1) as number;
            range.node.setRangeFontName(range.start, range.start + addedString.length, pluginSettings.mathFont);
            range.node.setRangeFontSize(range.start, range.start + addedString.length, size * pluginSettings.mathFontSize);
            //range.end = range.start +1;          
            figma.currentPage.selectedTextRange = {
                node: range.node,
                start: range.start + addedString.length + 1,
                end: range.start + addedString.length + 1
            };
        });
        // 

    }
}

async function matReplacer(text: TextNode) {

    // if there is no backslash in the text, then we return, so as to speed up the process
    if (text.characters.indexOf('\\') == -1 && text.characters.indexOf('_') == -1)
        return

    // find position from _ until whitespace

    let start = text.characters.indexOf('_');
    if (start != -1) {
        // find the closest whitespace
        let end = text.characters.indexOf(' ', start);
        if (end != -1) {
            const font = text.getRangeFontName(start, start + 1);
            await figma.loadFontAsync(font as FontName);
            text.deleteCharacters(start, start + 1);
            text.setRangeTextCase(start, end - 1, 'LOWER');

        }
        // get the font of the text 

    }

   
    // find position where \alpha starts
    for (const key in latexDict) {
        start = text.characters.indexOf('\\' + key+' ');
        if (start != -1) {
            // get the font of the text 
            const font = text.getRangeFontName(start, start + 1);
        
            await figma.loadFontAsync(pluginSettings.mathFont);
            await figma.loadFontAsync(font as FontName);
            text.deleteCharacters(start, start + key.length + 1);
            text.insertCharacters(start, latexDict[key]);
            text.setRangeFontName(start, start + latexDict[key].length, pluginSettings.mathFont);
        }
    }

    for (const key in capsDict) {
        start = text.characters.indexOf('\\' + key + ' ');
        if (start != -1) {
            try {
            const font = text.getRangeFontName(start, start + 1);
            await figma.loadFontAsync(font as FontName);
            text.deleteCharacters(start, start + key.length + 1);
            text.insertCharacters(start, capsDict[key]);
            // make it all caps
            text.setRangeTextCase(start, start + capsDict[key].length, 'SMALL_CAPS');
            text.setRangeTextCase(start + capsDict[key].length, start + capsDict[key].length + 1, 'ORIGINAL');
            }
            catch (e) {
                figma.notify("Could not apply small caps.");
            }

        }
    }


}