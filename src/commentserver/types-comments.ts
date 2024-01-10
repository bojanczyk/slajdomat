export { Comment, CommentServerMessage, messageToString, stringToMessage };

interface Comment {
    presentation: string;
    slide: string;
    comment: string;
    date: Date;
    author: string;
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

function messageToString(comment: CommentServerMessage): string {
    return encodeURI(JSON.stringify(comment));
}

function stringToMessage(s: string): CommentServerMessage {
    return JSON.parse(decodeURI(s)) as CommentServerMessage;
}