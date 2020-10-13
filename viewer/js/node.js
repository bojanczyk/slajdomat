const http = require('http');
const fs = require('fs');

const hostname = '127.0.0.1';
const port = 3000;


const server = http.createServer((req, res) => {
  let body = [];
  req.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    onMessage(body);
    // at this point, `body` has the entire request body stored in it as a string
    res.header("Access-Control-Allow-Origin", "*");
    res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Got message!');
  });

  
});

function onMessage(body) {
  console.log(body);
}

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

/*
fs.writeFile('newfile.txt', 'Learn Node FS module', function (err) {
  if (err) throw err;
  console.log('File is created successfully.');
});
*/
