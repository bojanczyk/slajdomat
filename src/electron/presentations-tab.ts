/*
this is code manages the presentations tab, which displays the current folder and the presentations in it
*/


import { ElectronMainToRenderer } from "./messages-main-renderer";
import { selectTab, sendElectronRendererToMain } from "./renderer";

export {receivePresentations}

//we receive the list of presentations in the current folder
function receivePresentations(msg: ElectronMainToRenderer): void {
    if (msg.type != 'presentation-list')
        throw ('wrong message');

    if (msg.gitscript != undefined) {
        (document.querySelector('#upload-script-text') as HTMLTextAreaElement).value = msg.gitscript;
    }

    function nameDiv(type: 'folder' | 'presentation', name: string) {
        const retval = document.createElement('div');
        retval.innerHTML = `
        <span class="toolbar-button"> <img src="${type == 'folder' ? '../src/icons/folder.svg' : '../src/icons/slideshow.svg'}"></span>${name}`;

        return retval;
    }

    function updateButton(name: string) {
        const retval = document.createElement('i');
        retval.classList.add('material-icons');
        retval.innerHTML = 'trending_up';
        retval.classList.add('toolbar-button');
        retval.addEventListener('click', () => {
            sendElectronRendererToMain({ type: 'upgrade', name: name });
        })
        return retval;
    }

    function revealButton(name: string, kind: 'folder' | 'presentation') {
        const retval = document.createElement('div');
        retval.innerHTML = `
        <span class="toolbar-button"> <img src="../src/icons/folder.svg"></span>`;
        retval.addEventListener('click', () => {
            sendElectronRendererToMain({ type: 'reveal-in-finder', name: name, kind: kind });
        })
        return retval;
    }

    document.querySelector('#presentations-head').classList.remove('hidden');
    document.querySelector('#upload-head').classList.remove('hidden');
    document.querySelector('#welcome-head').classList.add('hidden');

    //enable/disable the parent folder button depending on whether we are in the root of the current slide directory
    if (msg.atRoot)
        document.getElementById('parent-folder-button').classList.add('disabled')
    else
        document.getElementById('parent-folder-button').classList.remove('disabled');


    document.getElementById('upload-script-button').classList.remove('disabled');
    document.getElementById('link-to-current-folder').innerHTML = msg.dir;
    selectTab('presentations');


    //hide the text which says that there is no presentations folder selected
    document.getElementById('no-presentations-text').classList.add('hidden');

    //this is where the list of subfolders or presentations will be given
    const ul = document.getElementById("directory-listing");
    ul.innerHTML = '';



    if (Object.keys(msg.presentations).length == 0 && msg.subfolders.length == 0) {
        //if there are no presentations in the current directory, then a message is displayed which says that such presentations can be created using the figma plugin
        document.getElementById('empty-folder-text').classList.remove('hidden');
    } else {

        //if there are presentations in the current directory, then they are shown
        document.getElementById('empty-folder-text').classList.add('hidden');


        for (const i of Object.keys(msg.presentations)) {

            const li = document.createElement("div");
            li.classList.add('presentation-line');
            const name = nameDiv('presentation', i);
            li.appendChild(name)
            name.addEventListener('click', () => {
                sendElectronRendererToMain({ type: 'open-viewer', dir : msg.dir, file :  msg.presentations[i].file })
            })
            li.appendChild(revealButton(i, 'presentation'));
            if (!msg.presentations[i].updated) {
                //here there could be code for upgrading presentations, which is not currently used
                // li.appendChild(updateButton(i));
                // canUpgrade = true;
            }
            ul.appendChild(li);
        }


        for (const f of msg.subfolders) {
            const li = document.createElement("div");
            li.classList.add('presentation-line')
            const name = nameDiv('folder', f);
            li.appendChild(name);
            name.addEventListener('click', () => {
                sendElectronRendererToMain({ type: 'goto-folder', name: f });
            })
            ul.appendChild(li);
        }
    }
}
