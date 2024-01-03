export {
    presentationDir,
    fileName,
    sendToServer,
    fetchJSON,
    probeServer
}



import {
    userAlert
} from './html'

import { MessageToServer, ServerResponse } from './types';

import {
    manifest
} from './viewer'
import { list, save } from 'pdfkit';



//the directory where the slides are
function presentationDir(): string {
    return '.'
    // return  'slides/' + (new URL(window.location.href)).searchParams.get('slides'); 
}


function getServer() {
    return 'http://localhost:3001';
}


//gives the name for a file in a slide, in the current presentation
//the slide parameter could be null, for top-level information in the presentation.
function fileName(slide: string, file: string): string {

    if (slide == null) {
        return presentationDir() + '/' + file;
    } else
        return presentationDir() + '/' + manifest.slideDict[slide] + '/' + file;
}



/*
// failed attempt nr. 1 to stringify large objects
// the usual json.stringify fails on large objects, and I failed to use JSONStream stringify after may attepmts
function myStringify(msg : MessageToServer) : Readable {
    const retval = new Readable();

    if (msg.type == 'toPdf') {
        // this is the case that gives large results
        const savedSvgs = msg.svgs;
        msg.svgs = ['placeholder'];
        let firstString = JSON.stringify(msg);
        const twoParts = firstString.split("'placeholder'");
        retval.push(twoParts[0]);



        let length = 0;
        for (const svg of savedSvgs)
            {
                const str = JSON.stringify(svg);
                length += str.length;
                console.log('stringifying something, new length is'+ str.length + ' total length is' + length);
                retval.push(str+',');
            }

        retval.push(twoParts[1]);
    }
    else 
        retval.push(JSON.stringify(msg));

    return retval;
}

// failed second attempt
function myStringify2(msg : MessageToServer) : Readable {
    class MyReadableStream extends Readable {
      constructor(options : any) {
        super(options);
      }
    
      // Implement the _read method
      _read() {
        // Implement any logic if needed before pushing data
      }
    }
    
    // Instantiate your custom readable stream
    const myReadableStream = new MyReadableStream({ encoding: 'utf8' });
    
    // Create a JSONStream stringifier
    const stringifier = JSONStream.stringify();
    
    // Handle errors during stringification
    stringifier.on('error', (err) => {
      console.error('Error stringifying JSON:', err);
    });
    
    // Pipe the output of the JSON stringifier to the custom readable stream
    stringifier.pipe(myReadableStream);
}
*/



//send an object to the server
async function sendToServer(msg: MessageToServer): Promise<ServerResponse> {
    if (msg.type == 'slides' || msg.type == 'wav')
        msg.presentation = manifest.presentation;


    



    const json = JSON.stringify(msg);
    const response = await fetch(getServer(), {
        method: 'POST',
        body: json as any  //I cannot figure how to correctly type putting a stream into the body
    });
    if (!response.ok) {
        return { status : 'error', explanation : 'not connected' };
    } else
        {
           return await response.json() as ServerResponse;
        }
}




//get a json file and parse it
async function fetchJSON(filename: string): Promise<unknown> {
    try {
        const res = await fetch(filename);
        if (!(res.ok))
            throw "not connected";

        else
            return res.json();
    } catch (e) {
        userAlert("Could not load slide file " + filename);
        return null;
    }
}
 


async function probeServer() : Promise<boolean> {
    try {
        await fetch(getServer(), {
            method: 'POST',
            body: JSON.stringify({
                type: 'probe'
            })
        });
        return true;
    }
    catch (e) { return false; }
}