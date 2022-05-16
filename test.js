// Создаётся экземпляр клиента
var WebSocketClient = require('websocket').client;
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
        client1[i].connect('ws://localhost:9000/');
        //handler.bind(this, this.i);
        client1[i].on('connect', function (connection) {
            connection.send(JSON.stringify({ action: 'CODE', data: code, id: i, fromStartTime: Date.now() - startTime }));
            console.log('i = ', i);

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
// Вешаем на него обработчик события подключения к серверу

let startTime = Date.now();
let client1 = [];


let start = async function () {
    for (let i = 0; i < 1000; i++) {
        await myFunc(i);
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



