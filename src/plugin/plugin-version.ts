
export {
    upgradeVersion
}
import { } from '@figma/plugin-typings'

import {
    allSlides,
    getDatabase
} from './code'

import {
    Database
} from './plugin-types'

// import { version as versionNumber } from '../..//package.json';




//this function upgrades the data to the current version of the plugin. I expect the function to grow into a total mess.
// currently the version progression is 
// empty: original version
// 0.81: the id's are not from figma, and there is a merged property for events

function upgradeVersion(): void {


    const storedVersion = figma.root.getPluginData('version');

    //we upgrade incrementally, version after version
    if (storedVersion == '') {
        for (const slide of allSlides()) {
            //in old versions, the merged attribute did not exist
            const database :Database = getDatabase(slide);
            for (const event of database.events) {
                if (event.merged == undefined) {
                    event.merged = false;
                }
            }

            for (const event of database.events) {
                for (const child of slide.children) 
                {
                    if (event.id == child.id)
                        child.setPluginData('id',event.id)

                }
            }

        }
        console.log('Upgraded to slajdomat data version 0.81');
        figma.root.setPluginData('version', '0.81');
    }

}