import { spawn } from 'child_process';

import { messageToString, CommentServerMessage } from './types-comments'

const comment = {
    presentation: 'example',
    slide: 'slide1',
    comment: 'this is a comment',
    date: new Date(),
    author: 'me'
}

const message : CommentServerMessage = {
    type: 'set',
    comment: comment
}

const child = spawn('php', ['comments.php?message='+messageToString(message) ]);

let output = '';
child.stdout.on('data', (data) => {
    output += data;
});

child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    console.log(`Output: ${output}`);
});