
const port = process.env.PORT || 8080;
let pabcexePath = "/opt/pabcnetc/pabcnetc.exe";

const db = require('./database.js');
const { exec } = require("child_process");
const WebSocket = require('ws');
const { SHA3 } = require('sha3');
const wsServer = new WebSocket.Server({ port: port, 'Access-Control-Allow-Origin': "*" });


wsServer.on('connection', function connection(ws, req) {
    const ip = req.connection.remoteAddress.split(":").pop();//headers['x-forwarded-for'];
    console.log(ip);
});

wsServer.on('connection', onConnect);

async function onConnect(wsClient) {

    console.log('Новый пользователь');
    wsClient.send(JSON.stringify({ action: "HELLO", data: 'Привет' }));

    wsClient.on('message', async function (message) {
        let startTime = Date.now();
        //console.log(message); log buffered message
        try {
            let jsonMessage;
            try {
                jsonMessage = JSON.parse(message);
            } catch (error) {
                console.log(error);
                jsonMessage = message;
            }

            console.log(jsonMessage);//log parsed message
            switch (jsonMessage.action) {
                case 'ECHO':
                    wsClient.send(jsonMessage.data);
                    break;

                case 'PING':
                    setTimeout(function () {
                        wsClient.send('PONG');
                    }, 2000);
                    break;

                case 'GUEST_AUTH': {
                    let sugar = Date.now();
                    let hash = get_hash(sugar, sugar);
                    insertGuest(hash, 86400);
                    wsClient.send(JSON.stringify({ action: 'GUEST_AUTH_OK', hash: hash }))
                    break;
                }
                case 'SIGNUP':
                    let new_hash = get_hash(jsonMessage.login, jsonMessage.password);
                    console.log('hash: ' + new_hash);
                    if (await existLogin(jsonMessage.login)) {
                        console.log('exist login true');
                        wsClient.send(JSON.stringify({ action: "SIGNUP_LOGIN_USED" }));
                    }
                    else {
                        //add new user to db
                        console.log('exist login false');
                        console.log('new user: ' + jsonMessage.login);
                        signupUser(jsonMessage.login, new_hash, 'student');
                        wsClient.send(JSON.stringify({ action: "SIGNUP_SUCCESSFUL", hash: new_hash }));
                    }
                    break;

                case 'AUTH_COOKIE':
                    if (await existHash('users', jsonMessage.hash)) {
                        wsClient.send(JSON.stringify({ action: "AUTH_OK" }))
                    }
                    break;

                case 'AUTH_LOGIN': {
                    let new_hash = get_hash(jsonMessage.login, jsonMessage.password);
                    if (await existLogin(jsonMessage.login) && await existHash('users', new_hash)) {
                        wsClient.send(JSON.stringify({ action: "LOGIN_CORRECT", hash: new_hash }))
                    }
                    else {
                        wsClient.send(JSON.stringify({ action: "LOGIN_INCORRECT" }))
                    }
                    break;
                }

                case 'SAVEFILE':
                    let data = new String(jsonMessage.data);
                    break;

                case 'CODE':
                    let data = new String(jsonMessage.data);
                    console.log(data.toString());

                    if (jsonMessage.hash === 'undefined' || (!existHash(jsonMessage.hash, 'users') && !existHash(jsonMessage.hash, 'guests'))) {
                        wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: `You didn't authenticate, please refresh page` }));
                        break;
                    }
                    let filename;
                    if (jsonMessage.filename === 'undefined') {
                        filename = jsonMessage.hash + (await getFiles(jsonMessage.hash)).rowCount
                    } else {
                        filename = jsonMessage.filename;
                    }


                    exec(`echo "${data.toString()}" > ./user_data/${filename}.pas`, (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                        }
                        if (stderr) {
                            console.log(`stderr: ${stderr}`);
                        }
                        if (stdout) {
                            console.log(`stdout: ${stdout}`);
                        }
                    });

                    exec(`mono ${pabcexePath} ./user_data/${filename}.pas ./user_data/${filename}.exe`, (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                            console.log(`stdout: ${stdout}`);
                            wsClient.send(stdout.slice(341));
                        }
                        if (stderr) {
                            console.log(`stderr: ${stderr}`);
                        }
                        if (!error) {
                            exec(`mono ./user_data/${filename}.exe`, (error, stdout, stderr) => {
                                if (error) {
                                    console.log(`error: ${error.message}`);
                                }
                                if (stderr) {
                                    console.log(`stderr: ${stderr}`);
                                }
                                console.log(`stdout: ${stdout}`);
                                wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: stdout }));
                                saveFile(jsonMessage.hash, filename, data);
                                //wsClient.send(stdout);
                            });
                        }
                    });
                    break;
            }
        } catch (error) {
            console.log('Ошибка: ', error);
        }
        console.log(`Сообщение обработана за: ${Date.now() - startTime} ms`)

    });
    wsClient.on('close', function () {
        console.log('Пользователь отключился');
    });
}

function get_hash(login, password) {
    let hash = new SHA3(256);
    hash.update(login + password);
    return hash.digest({ buffer: Buffer.alloc(32), format: 'hex' });
}

async function insertGuest(hash, lifetime) {
    let data = new Date(Date.now() + lifetime * 1000).toISOString().slice(0, 19).replace('T', ' ');
    return await db.query('INSERT INTO guests (hash, lifetime) VALUES ($1, $2)', [hash, data]);
}

async function existLogin(nick) {

    let res = await db.query('SELECT nickname FROM users WHERE nickname = $1', [nick.toString()]);

    console.log('aaaaaaaaaaaaaaa: ' + res.rows[0] + " nick: " + nick)
    try {
        return res.rows[0].nickname === nick ? true : false
    } catch (e) {
        console.log('catch exists error: ' + e)
        return false
    }
    return res.rowCount == 1 ? true : false
}

async function saveFile(passhash, filename, code) {
    return await db.query('INSERT INTO files (passhash, filename, code) VALUES ($1, $2, $3)', [passhash, filename, code])
}

async function existHash(hash, table) {

    let res = await db.query('SELECT passhash FROM $1 WHERE passhash = $2', [table, hash.toString()]);

    console.log('aaaaaaaaaaaaaaa: ' + res.rows[0] + " nick: " + nick)
    /*try {
        return res.rows[0].passhash === hash ? true : false
    } catch (e) {
        console.log('catch exists error: ' + e)
        return false
    }*/
    return res.rowCount == 1 ? true : false;
}

async function getFiles(hash) {
    return await db.query('SELECT filename, code FROM files WHERE passhash = $1', [hash])
}
async function signupUser(login, hash, privileges) {

    return await db.query('insert into users (passhash, nickname, privileges) values ($1, $2, $3)', [hash, login, privileges]);
}

function checkConnectToDatabase() {

}

function findUserInDatabase() {

}

/*function readJson(jsonPath) {
    const { readFile } = require('fs');
    let file = new readFile(jsonPath, (err, data) => {
        if (err) throw err;
        console.log("data: " + data);
        return data;
    });'/'

    let fs = require('fs');
    fs.access('/var/www/html/hashes.json', fs.F_OK, (err) => {
        if (err) {
            console.log("Error: "+err);
            console.log("Creating hashes.json");
            writeJson('/var/www/html/hashes.json', JSON.stringify({ "users": [{ "login": "asdf", "hash":"8248ba075fbea018d0e90f4596f86c737478e5217cdb9f758388d17ab552123d"}]}));
        }

        
    });
    //file exists
    /*fs.readFile(jsonPath, (err, data) => {
        if (err) throw err;
        console.log("data: " + JSON.parse(data).users[0]);
        return data;
    });'*'

    let data = fs.readFileSync(jsonPath);
    console.log(`data1: ${data} \ndata2: ${JSON.parse(data)}`);
    return data;
    
    //console.log('Data read from file ' + file);
    //return file;
}

function writeJson(jsonPath, jsonArray) {
    const { writeFile } = require('fs');
    let file = new writeFile(jsonPath, jsonArray, (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
}

function addUser(login, hash) {
    let jsonData = readJson('/var/www/html/hashes.json');
    console.log(`typeof: ${typeof (jsonData)} \ntypeof: ${typeof (JSON.parse(jsonData))} \njsonData: ${jsonData} \njsonData.users ${jsonData.users} \njsonData.users ${JSON.parse(jsonData).users} \njsonData.toString()${jsonData.toString()}`);
    //let jsonData = readJson('/var/www/html/hashes.json');
    JSON.parse(jsonData)['users'].push({ "login": login, "hash": hash, "files": [] });
    console.log('After writing: ' + jsonData + '\nAfter2: ' + JSON.parse(jsonData));
    writeJson('/var/www/html/hashes.json', JSON.stringify(jsonData));
}
*/

/*http.listen(port, () =>
  console.log(`Server listens http://:${port}`)
)*/
console.log(`Сервер запущен на ${port} порту`);
