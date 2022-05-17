
const port = process.env.PORT || 8080;
var pabcexePath = "/opt/pabcnetc/pabcnetc.exe";

const db = require('./database.js');
const WebSocket = require('ws');
const wsServer = new WebSocket.Server({ port: port, 'Access-Control-Allow-Origin': "*" });


wsServer.on('connection', function connection(ws, req) {
  const ip = req.connection.remoteAddress.split(":").pop();//headers['x-forwarded-for'];
  console.log(ip);
});

wsServer.on('connection', onConnect);

async function onConnect(wsClient) {

    console.log('Новый пользователь');
    wsClient.send(JSON.stringify({action: "HELLO", data: 'Привет'}));

    wsClient.on('message', async function (message) {
        var startTime = Date.now();
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

                case 'SIGNUP':
                    let new_hash = get_hash(jsonMessage.login, jsonMessage.password);
                    console.log('hash: ' + new_hash);
                    if (existLogin(jsonMessage.login)) {
                        
                        wsClient.send(JSON.stringify({ action: "SIGNUP_LOGIN_USED"}))
                    }
                    else {
                        //add new user to db
                        console.log('new user: ' + jsonMessage.login);
                        //signupUser(jsonMessage.login, new_hash, 'student');
                    }
                    
                    //console.log('getClient() = ')
                    //addUser(jsonMessage.login, new_hash);
                    //break;
					
				case 'LOGIN':
                    let myhash = get_hash(jsonMessage.login, jsonMessage.password);
					console.log(`action: ${jsonMessage.action}, login: ${jsonMessage.login}, pass: ${jsonMessage.password}, tgz: ${jsonMessage.login+jsonMessage.password}, hash: ${myhash}`);
                    break;

                case 'AUTH':
                    let jsonData;
                    try {
                        jsonData = JSON.parse(readJson('/var/www/html/hashes.json'));
                    }
                    catch (e) {
                        console.log(`File Error: ${e}`);
                    }
                    jsonData.find(el => el.hash === jsonMessage.data);
                    break;

                case 'SAVEFILE':
                    var data = new String(jsonMessage.data);
                    break;

                case 'CODE':
		            const { exec } = require("child_process");
                    var data = new String(jsonMessage.data);
                    //var id = new String(jsonMessage.id);
                    console.log(data.toString());
                    var fileName = `p.pas`;
                    //exec("echo " + '"'+ data.toString() +'"'+ " > p.pas"
                    exec(`echo "${data.toString()}" > ./user_data/${jsonMessage.id}.pas`, (error, stdout, stderr) => {
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

                    exec(`mono ${pabcexePath} ./user_data/${jsonMessage.id}.pas ./user_data/${jsonMessage.id}.exe`, (error, stdout, stderr) => {
    			        if (error) {
    			            console.log(`error: ${error.message}`);
    			            console.log(`stdout: ${stdout}`);
			                wsClient.send(stdout.slice(341));
			            }
			            if (stderr) {
    			            console.log(`stderr: ${stderr}`);

			            }
			            if (!error) {
                            exec(`mono ./user_data/${jsonMessage.id}.exe`, (error, stdout, stderr) => {
    			                if (error) {
    				                console.log(`error: ${error.message}`);
			                    }
			                    if (stderr) {
    				                console.log(`stderr: ${stderr}`);
			                    }
			                    console.log(`stdout: ${stdout}`);
								wsClient.send(JSON.stringify({action: "COMPILER_ANSWER", data: stdout}));
			                    //wsClient.send(stdout);
			                });
			            }
		            });
                    break;
            }
        }   catch (error) {
                console.log('Ошибка: ', error);
        }

        const { exec } = require("child_process");
        console.log(`Сообщение обработана за: ${Date.now() - startTime} ms`)

    });
    wsClient.on('close', function() {
        console.log('Пользователь отключился');
    });
}

function get_hash(login, password) {
    const { SHA3 } = require('sha3');
    let hash = new SHA3(256);
    hash.update(login + password);
    return hash.digest({ buffer: Buffer.alloc(32), format: 'hex' });
}

async function existLogin(nickname) {

    let res = db.query(`SELECT nickname AS nickname FROM users WHERE nickname = $1`,[nickname]);
    /*res.catch(error => {
        alert(error); // Error: Not Found
    })*/

    /* (err, res) => {
        if (err) {
            return console.error('error running query', err);
        }

        console.log('login from db: '+res.rows[0].nickname)
    });*/
    console.log('res: ' + res.row[0].nickname);

    /*const { Pool } = require('pg');

    const pool = new Pool({
        connectionString: 'postgres://troxojbzrlqhko:3c8664d451486b3378c39b12577d5fe6c7229d382982035920568850ad401d9e@ec2-52-212-228-71.eu-west-1.compute.amazonaws.com:5432/df1crp8nniui6p',
        ssl: {
            rejectUnauthorized: false
        }
    });*/

    /*await pool.query('select nickname as nickname from users where nickname = $1', [nickname], (err, res) => {
        if (err) {
            return console.error('error running query', err);
        }
        try {
            console.log('login from db: ' + res.rows[0].nickname)
        } catch (e) {
            return false;
        }
    });*/
}

function signupUser(login, hash, privileges) {

    return db.query('insert into users (passhash, nickname, privileges) values ($1, $2, $3)', [hash, login, privileges]);
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
