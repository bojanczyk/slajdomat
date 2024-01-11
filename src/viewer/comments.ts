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
    id : number,
    comment_text: string,
    date: Date,
    presentation: string,
    slide: string,
    who: string
}

type CommentServerMessage =
    {
        type: 'set',
        comment: Comment
    } |
    {
        type: 'get',
        presentation: string
    }





let phpScriptURL: string;
let currentSlide: SlideEvent;

function commentSlide(slide: SlideEvent) {
    currentSlide = slide;
}

async function initComments() {
    try {
        phpScriptURL = manifest.comments.server+'?message=';

        const commentContainer = document.querySelector('#comments');
        const message = { type: 'get', presentation: manifest.comments.presentation };
        const getScript = phpScriptURL + encodeURI(JSON.stringify(message));



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

    const newComment : Comment= {
        id : undefined, //this is set by the server
        comment_text: commentField.value,
        who: whoField.value,
        presentation: manifest.comments.presentation,
        slide: currentSlide.id,
        date : new Date()
    }

    const message : CommentServerMessage = { type: 'set', comment: newComment };
    const url = phpScriptURL + encodeURI(JSON.stringify(message));

    try {
        const response = await fetch(url);
        userAlert(await response.text());
        initComments();
    }
    catch (e) {
        console.log(e);
        userAlert('Failed to add comment');
    }       
    
    // let putScript = phpScriptURL + '?type=insert';
    // putScript += '&presentation=' + manifest.comments.presentation;
    // putScript += '&comment_text=' + encodeURIComponent(commentField.value);
    // putScript += '&who=' + encodeURIComponent(whoField.value);
    // putScript += '&slide=' + encodeURIComponent(currentSlide.id);


    // try {
    //     const response = await fetch(putScript);
    //     userAlert(await response.text());
    //     initComments();
    // }
    // catch (e) {
    //     console.log(e);
    //     userAlert('Failed to add comment');
    // }
}


document.querySelector('#add-comment-button').addEventListener('click', addComment);