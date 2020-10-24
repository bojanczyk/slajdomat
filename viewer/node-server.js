const express = require('express');
const cors = require('cors');
const fs = require('fs');
const {
    exec
} = require("child_process");
const {
    stringify
} = require('querystring');

const app = express();

//this enables the localhost access to work
app.use(cors())


//web server
var connect = require('connect');
var serveStatic = require('serve-static');

connect()
    .use(serveStatic(__dirname))
    .listen(8080, () => console.log('Server running on 8080...'));



//sanitize a string so that it is a good filename 
function sanitize(s) {
    return encodeURI(s).replace(/:/g, "_").replace(/%20/g, '_').replace(/%/g, '#');
}

function presentationDir(presentationName) {

    if (!(presentationName in presentations)) {
        presentations[presentationName] = "slides/" + sanitize(presentationName);
        writeFile(null, null, 'slides/presentations.json', JSON.stringify(presentations));
    }
    return presentations[presentationName];
}

function slideDir(slideName) {
    return sanitize(slideName)
}

function readJSON(presentation, slide, name) {
    const filename = fileName(presentation,slide,name);
    try {
    const data = fs.readFileSync(filename);
    const json =  JSON.parse(data);
    return json;
    }
    catch (error) {return {}}
}


function writeFile(presentation, slide, name, file) {
    if (presentation != null) {
        if (!fs.existsSync('slides'))
            fs.mkdirSync('slides');
        var dir = fileName(presentation, null, null);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir);
        dir = fileName(presentation, slide, null);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir);
    }

    const filename = fileName(presentation, slide, name);
    fs.writeFile(filename, file, function (err) {
        if (err) throw err;
        console.log(filename + ' written.');
    });
}


function fileName(presentation, slide, name) {
    var retval = ''

    if (presentation == null & slide == null)
        return name;

    if (presentation != null)
        retval += presentationDir(presentation)

    if (slide != null)
        retval += '/' + slideDir(slide);

    if (name != null)
        retval += '/' + name;


    return retval;

}
//we get a single sound, in the wav format
function onGetWav(msg) {
    var buffer = new Uint8Array(msg.file)
    var fileName = presentationDir(msg.presentation) + '/' + slideDir(msg.slide) + '/' + msg.name;
    writeFile(msg.presentation, msg.slide, msg.name + '.wav', buffer);

    exec('ffmpeg -y -i ' + fileName + '.wav ' + fileName + '.mp3', (error, stdout, stderr) => {
        if (error) {
            console.log(`ffmpeg command failed: ${error.message}`);
            return;
        }
        console.log(fileName + `.mp3 created successfully.`);
    });
}

//we get a json file, to be stored in the root dir
function onGetJSON(msg) {
    console.log("getting a json ");'slide'
    writeFile(msg.presentation, msg.slide, msg.name + '.json', JSON.stringify(msg.body));
}



function onGetSlide(msg) {
    console.log("getting slide list for " + msg.presentation);
    const manifest = {
        presentation: msg.presentation,
        root: msg.slideList[0].database.id,
        slideDict: {},
        tree : msg.tree
    }

    //if there were some sounds previously saved, we keep them
    var oldmanifest = readJSON(msg.presentation,null,'manifest.json');
    if ('soundDict' in oldmanifest) 
        manifest.soundDict = oldmanifest.soundDict;
    else 
        manifest.soundDict = {};
        

    var presDir = presentationDir(msg.presentation);
    for (const slide of msg.slideList) {
        var dir = slideDir(slide.database.id)
        manifest.slideDict[slide.database.id] = dir;
        // writeFile(msg.presentation, slide.database.id, 'events.json', JSON.stringify(slide.database));
        writeFile(msg.presentation, slide.database.id, 'image.svg', slide.svg);
    }
    writeFile(msg.presentation, null, 'manifest.json', JSON.stringify(manifest,null,2));


}

app.post('/', function (req, res) {
    let body = [];
    req.on('data', (chunk) => {
        body.push(chunk);
    }).on('end', () => {
        body = Buffer.concat(body).toString();
        var msg = JSON.parse(body);

        if (msg.type == 'wav')
            onGetWav(msg);

        if (msg.type == 'json')
            onGetJSON(msg);

        if (msg.type == 'slides')
            onGetSlide(msg);


        res.send('POST request to the homepage');
    });
})


var presentations;

presentations = readJSON(null,null, 'slides/presentsations.json');
if (presentations == {})
    console.log("no presentations file");
        


app.listen(3000, () => {
    console.log('server is listening on port 3000');
});
