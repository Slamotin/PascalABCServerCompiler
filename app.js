const ws = new require('ws');
const wss = new ws.Server({noServer: true});

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
