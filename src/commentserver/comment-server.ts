import fs from 'fs';
import querystring from 'querystring';

import { Comment, stringToMessage, CommentServerMessage } from './types-comments'


//read the first argument, which is the message
const messageString = process.argv[2];
const message = stringToMessage(messageString);

console.log('hello');
console.log(message);

// Read the command-line arguments
const args = process.argv.slice(2);
const requestMethod = args[0];
const slide = args[1];

//if the file comments.json does not exist, create it, and write an empty array
if (!fs.existsSync('comments.json')) {
    fs.writeFile('comments.json', '[]', err => {
        if (err) {
            console.error('could not create comments.json');
            return;
        }
    });
}

//read comments from file
const data = fs.readFileSync('comments.json', 'utf8');
let comments: Comment[] = JSON.parse(data);

switch (message.type) {
    case 'set':
        comments.push(message.comment);
        fs.writeFile('comments.json', JSON.stringify(comments), err => {
            if (err) {
                console.error('failed to write comments to file');
                return;
            }
            console.log('added comment to file');
        });
        break;

    case 'get':
        //find all comments that match the presentation
        const presentationComments = comments.filter(comment => comment.presentation == message.presentation);
        console.log(presentationComments);
    break;
}
