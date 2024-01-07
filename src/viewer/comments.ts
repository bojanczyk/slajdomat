/*
Handles the comments to slides
*/

import { findZoomEvent } from "./event";
import { userAlert } from "./html";
import { currentStep, eventToStep, gotoStep } from "./timeline";
import { SlideEvent } from "./types";
import { manifest, userAgent } from "./viewer";

export { initComments, commentSlide }

type Comment = {
    comment_text: string,
    id: number,
    date: string,
    presentation: string,
    slide: string,
    who: string
}

let phpScriptURL: string;
let currentSlide: SlideEvent;

function commentSlide(slide: SlideEvent) {
    currentSlide = slide;
}

async function initComments() {
    try {
        phpScriptURL = manifest.comments.server;

        const commentContainer = document.querySelector('#comments');
        let getScript = phpScriptURL + '?type=get';
        getScript += '&presentation=' + manifest.comments.presentation;


        //remove all comments
        while (commentContainer.firstChild) {
            commentContainer.removeChild(commentContainer.firstChild);
        }

        //load the comments from the database

        const response = await fetch(getScript);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const comments: Comment[] = await response.json();
        for (const comment of comments) {

            const date = new Date(comment.date);
            const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const newDiv = document.createElement('div');
            newDiv.classList.add('comment');
            newDiv.innerHTML = `
            <div> ${comment.comment_text} </div> 
            <div> ${formattedDate}  ${(comment.who == '') ? 'by anonymous' : 'by ' + comment.who} </div>`
            commentContainer.appendChild(newDiv);
            newDiv.addEventListener('click', () => {
                const event = findZoomEvent(comment.slide);
                const step = eventToStep(event, 'last');
                gotoStep(step);
            })
        }


    } catch (error) {
        document.querySelector('#comments-tab-head').classList.add('hidden');
    }



}


async function addComment() {

    const commentField = document.querySelector('#comment-content') as HTMLInputElement;
    const whoField = document.querySelector('#comment-name') as HTMLInputElement;

    let putScript = phpScriptURL + '?type=insert';
    putScript += '&presentation=' + manifest.comments.presentation;
    putScript += '&comment_text=' + encodeURIComponent(commentField.value);
    putScript += '&who=' + encodeURIComponent(whoField.value);
    putScript += '&slide=' + encodeURIComponent(currentSlide.id);


    try {
        const response = await fetch(putScript);
        userAlert(await response.text());
        initComments();
    }
    catch (e) {
        console.log(e);
        userAlert('Failed to add comment');
    }
}


document.querySelector('#add-comment-button').addEventListener('click', addComment);