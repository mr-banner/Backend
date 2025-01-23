const http = require('http');

const hostname = '127.0.0.1'
const port = 3000

const server = http.createServer((req,res)=>{
    if (req.url === '/') {
        res.statusCode = 200;
        res.setHeader('Content-Type','text/plain');
        res.end("Creating my first http server");
    }else if(req.url === '/about'){
        res.statusCode = 200;
        res.setHeader('Content-Type','text/plain');
        res.end("About page");
    }
    else{
        res.statusCode = 404;
        res.setHeader('Content-Type','text/plain');
        res.end("Page not found");
    }
})

server.listen(port,hostname,()=>{
    console.log(`Serevr running at http://${hostname}:${port}/`);
    
})