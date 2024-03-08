import { PresentationNode } from "../common/types";
import { eventHover, postMessageToCode } from "./ui";

export { eventList }



function eventIconClick(index: number): void {
    postMessageToCode({
        type: 'clickEvent',
        index: index
    });
}

function eventRemoveClick(index: number): void {
    postMessageToCode({
        type: 'removeEvent',
        index: index
    });
}




//the button to merge events was clicked, we want to merge index with its predecessor (or de-merge)
function mergeEventClick(index: number): void {
    postMessageToCode({
        type: 'mergeEvent',
        index: index
    })
}

//get the list of events for the current slide
function eventList(events: PresentationNode[], selected: number): void {

    //make a list item for the list of events 
    function makeEvent(event: PresentationNode, index: number): HTMLDivElement {

        const retval = document.createElement('div');
        retval.classList.add('list-item');
        retval.innerHTML = '<div class="animate-bar"></div><i class="material-icons"></i><div class="list-label"> </div><div class="list-buttons"><i class="material-icons">delete_outline</i></div>';

        const label = retval.querySelector('.list-label') as HTMLElement;

        label.addEventListener('mouseenter', () => {
            eventHover(index)
        })
        label.addEventListener('mouseleave', () => {
            eventHover(-1)
        })

        if (event.type == 'child')
            label.addEventListener('click', () => {
                postMessageToCode( {
                    type: 'gotoSlide',
                    which: { slideId: event.id }
                });
            });

        const animateBar = retval.querySelector('.animate-bar') as HTMLElement;
        if (selected == undefined || i >= selected)
            animateBar.classList.add('future');

        animateBar.addEventListener('click', (e) => {
            // check if the click is in the upper or lower half of the item
            const rect = retval.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const height = rect.bottom - rect.top;
            const fraction = y / height;

            postMessageToCode({
                type: 'clickAnimateBar',
                index: (fraction < 0.5) ? index : index + 1
            })
        })

        const iconNode = retval.querySelector('i') as HTMLElement;
        iconNode.addEventListener('click', () => {
            eventIconClick(index)
        })

        const deleteButton = retval.querySelector('.list-buttons').childNodes[0] as HTMLElement;
        deleteButton.addEventListener('click', () => {
            eventRemoveClick(index)
        })

        if (event.enabled == 'disabled')
            retval.classList.add("disabled");

        switch (event.type) {
            case "show":
                iconNode.innerHTML = "visibility";
                break;
            case "hide":
                iconNode.innerHTML = "visibility_off";
                break;
            case "animate":
                iconNode.innerHTML = "animation";
                break;
            case "child":
                iconNode.innerHTML = "zoom_out_map";
                break;
            default:
                throw "unexpected event type"
        }

        const labelNode = retval.querySelector('.list-label') as HTMLElement;
        labelNode.innerHTML = event.name;
        return retval;
    }

    //make an item that separates two events
    function makeSpacer(event: PresentationNode, index: number, canMerge: boolean): HTMLDivElement {
        const div = document.createElement('div');

        div.classList.add('spacer');
        div.innerHTML = '<div class="animate-bar"></div><div></div>'
        const animateBar = div.childNodes[0] as HTMLElement;
        const separator = div.childNodes[1] as HTMLElement;
        if (index > selected)
            animateBar.classList.add('future');

        if (canMerge) {
            const mergeIcon = document.createElement('i');
            mergeIcon.classList.add('material-icons');
            if (event.merged)
                mergeIcon.innerHTML = 'link_off'
            else
                mergeIcon.innerHTML = 'link';
            separator.appendChild(mergeIcon);
            mergeIcon.addEventListener('click', () => { mergeEventClick(index) })
        }

        if (event.merged)
            div.classList.add('merged');

        animateBar.addEventListener('click', (e) => {
            postMessageToCode({
                type: 'clickAnimateBar',
                index: index
            })
        })
        return div;
    }

    const eventListHTML = document.getElementById("event-list");
    eventListHTML.innerHTML = "";

    let i = 0;
    while (i < events.length) {
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('dropzone');
        groupDiv.setAttribute('draggable', 'true');
        do {
            if (i > 0) {
                //an event can be merged with the previous one if either both are child events, or both are show/hide events
                let canMerge = false;
                if (events[i].type == 'child' && events[i - 1].type == 'child') {
                    canMerge = true;
                }
                if (events[i].type != 'child' && events[i - 1].type != 'child') {
                    canMerge = true;
                }
                groupDiv.appendChild(makeSpacer(events[i], i, canMerge));
            }
            groupDiv.appendChild(makeEvent(events[i], i));
            i++;
        } while ((i < events.length) && (events[i].merged))
        eventListHTML.appendChild(groupDiv);
    }
}
