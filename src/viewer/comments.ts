/*
Handles the comments to slides
*/


import doc from "pdfkit";
import { userAlert } from "./html";
import { currentState, decodeState, encodeState, gotoState } from "./timeline";
import { StateJSON } from "../common/types";
import { manifest } from "./viewer";

export { initComments };



type Comment = {
    id : number,
    comment_text: string,
    date: Date,
    presentation: string,
    state: StateJSON,
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
                const state = decodeState(comment.state);
                gotoState(state);
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
        state: encodeState(currentState()),
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
}

const addCommentButton = document.querySelector('#add-comment-button');
addCommentButton.addEventListener('click', addComment);
