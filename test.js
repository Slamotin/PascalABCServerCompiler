// Создаётся экземпляр клиента
var WebSocketClient = require('websocket').client;
const timers = require('timers-promises');

let code = `//Simple example
var a, b, c: integer;
begin
a:= 2;
b:= 3;
c:= 4;
writeln(sqr(a) + b * c);
end.
	`;

function handler(connection, i) {
    connection.on('message', function (message) {
        // делаем что-нибудь с пришедшим сообщением
        console.log(message);
    });

    connection.on('error', function (error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function () {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function (message) {
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
        }
    });
    // посылаем сообщение серверу
    connection.send(JSON.stringify({ action: 'PING', data: i }));
    console.log('i = ', i);
}

async function myFunc(i) {
        client1[i] = new WebSocketClient();
        //client1[i].connect('wss://nodejs-webcompiler-server.herokuapp.com:433');
        client1[i].connect('ws://192.168.88.17:8080');
//handler.bind(this, this.i);
    client1[i].on('connect', function (connection) {
//        setInterval(() => {
        connection.send(JSON.stringify({ action: 'COMPILE_CODE'
	,data: code
	,hash: 'c7fa4136956af3b221021f5a197d2a4ca553899aaa2ccfa05e852fa0502356ea'
	, id: i
	, fromStartTime: Date.now() - startTime 
	, filename: `new_file${i}.pas`
}));
            console.log('i = ', i);
 //       }, 1000000)
            connection.on('error', function (error) {
                console.log("Connection Error: " + error.toString());
            });
            connection.on('close', function () {
                console.log('echo-protocol Connection Closed');
            });
            connection.on('message', function (message) {
                if (message.type === 'utf8') {
                    console.log("Received: '" + message.utf8Data + "'");
                }
            });
        })

}
let startTime = Date.now();
let client1 = [];

let start = async function () {
    for (let i = 0; i < 10; i++) {
        await myFunc(i);
	await timers.setTimeout(10);
    }
}

start()
// Подключаемся к нужному ресурсу
/*for (let i = 0; i < 1000; i++) {
    (async () => {
        client1[i] = new WebSocketClient();
        client1[i].connect('ws://localhost:9000/');
        //handler.bind(this, this.i);
        client1[i].on('connect', function (connection) {
            connection.send(JSON.stringify({ action: 'PING', data: i, fromStartTime: Date.now() - startTime}));
            console.log('i = ', i);
        })
        client1[i].on('message', function (message) {
            if (message.type === 'utf8') {
                console.log("Received: '" + message.utf8Data + "'" + "From start time:" + Date.now() - startTime);
            }
        });
        
    })();
}*/
console.log(`time ${Date.now() - startTime}`)



