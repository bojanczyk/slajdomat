export {
    dragDrop,
    dragStart,
    dragOver
}

import { postMessageToCode } from './ui'

// reordering events in the event list. I use a manual implementation of reordering via dragging

const dragStruct = {
    sourceIndex: null as number,
    targetIndex: null as number,
    sourceDom: null as HTMLElement
}


//returns the index of a dom element in the list of events
function dragIndex(target: HTMLElement) {

    while (target != null && !target.classList.contains('dropzone')) {
        target = target.parentElement;
    }

    if (target == null)
        return -1;

    let retval = -1;
    let index = 0;
    const eventList = document.getElementById('event-list').children;
    for (const child of eventList) {
        if (child == target)
            retval = index;
        if (child.classList.contains('dropzone'))
            index++;
    }
    return retval;
}



function dragStart(event: DragEvent) : void {
    const target = event.target as HTMLElement
    dragStruct.sourceDom = target;
    dragStruct.sourceIndex = dragIndex(target);
    target.classList.add('drag-source')
}

function dragOver(event: DragEvent) : void {
    event.preventDefault();
    const index = dragIndex(event.target as HTMLElement);
    if (index >= 0) {
        dragStruct.targetIndex = index;
        let i = 0;
        const eventList = document.getElementById('event-list').children;
        for (const child of eventList) {
            if (child.classList.contains('dropzone')) {
                if (i == index) {
                    if (index <= dragStruct.sourceIndex) {
                        child.classList.add('dropzone-above');
                    } else {
                        child.classList.add('dropzone-below');
                    }
                } else {
                    child.classList.remove('dropzone-below');
                    child.classList.remove('dropzone-above');
                }
                i++;
            }
        }
    }
}

function dragDrop() : void {
    postMessageToCode({
        type: 'moveEvent',
        index: dragStruct.sourceIndex,
        target: dragStruct.targetIndex
    });
}