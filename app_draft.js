const ws = new require('ws');
const wss = new ws.Server({noServer: true});


//const { json } = require('express');
//const app = require('express');
//const { connect } = require('http2');

//const http = require('http').createServer(app);
//const wsServer = require('socket.io')(http);

/*wsServer.on('connection', function conn(req,res){
   res.writeHead(200, {
    'Set-Cookie': 'mycookie=test',
    'Content-Type': 'text/plain'
  });
});*/


/*let jsonData = readJson('/var/www/html/hashes.json');

                    function check_hash() {
                        //for (a of user_profile.users) { if (a.description === "facebook1") { return true; } else { return false; }; };
                        for (user in jsonData.users) {
                            if (user.hash === myhash.toString("hex")) {
                                return true;
                            }
                        }
                        return false;
                    };

                    //if (jsonData.forEach((elem,index) => { if (elem.hash === myhash.toString("hex")) { return true;}})) {
                    if (check_hash()) {
                        //correct login+pass
                        //send hash and lifetime in seconds for save this in cookie
                        wsClient.send(JSON.stringify({ action: "LOGIN_CORRECT", data: myhash.toString("hex"), lifetime: "" }));
                        console.log("login_correct" + login + password + hash);
                    }
                    else {
                        wsClient.send(JSON.stringify({ action: "LOGIN_INCORRECT", data: "" }));
                    }
                    //registration writeJson('/var/www/html/hashes.json', JSON.stringify());*/

const clients = new Set();
var http = require('http');
console.log('start');
http.createServer((req, res) => {
  // в реальном проекте здесь может также быть код для обработки отличных от websoсket-запросов
  // здесь мы работаем с каждым запросом как с веб-сокетом
  wss.handleUpgrade(req, req.socket, Buffer.alloc(0), onSocketConnect);
});

function onSocketConnect(ws) {
  clients.add(ws);
    console.log('Log1');
  ws.on('message', function(message) {
    message = message.slice(0, 50); // максимальный размер сообщения 50
    console.log('Log2');
    for(let client of clients) {
      client.send(message);
    }
  });

  ws.on('close', function() {
    clients.delete(ws);
  });
}
