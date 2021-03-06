const port = process.env.PORT || 8080;
let pabcexePath = "/opt/pabcnetc/pabcnetc.exe";

const db = require('./database.js') || require('database.js');
const { exec, spawn, spawnSync } = require("child_process");
const WebSocket = require('ws');
const { SHA3 } = require('sha3');
const { isBuffer } = require('util');

//const { Hash } = require('crypto');

//const pidusage = require('pidusage');

const wsServer = new WebSocket.Server({ port: port, 'Access-Control-Allow-Origin': "*", perMessageDeflate: false });

wsServer.on('connection', function connection(ws, req) {
    const ip = req.connection.remoteAddress.split(":").pop();//headers['x-forwarded-for'];
    console.log(ip);
});

wsServer.on('connection', onConnect);

async function onConnect(wsClient) {

    console.log('Новый пользователь');
    wsClient.send(JSON.stringify({ action: "HELLO", data: 'Привет, готово к работе!' }));

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

            //console.log(jsonMessage);//log parsed message
            switch (jsonMessage.action) {
                case 'ECHO': {
                    wsClient.send(jsonMessage.data);
                    break;
                }
                case 'PING': {
                    setTimeout(function () {
                        wsClient.send('PONG');
                    }, 2000);
                    break;
                }
                case 'SAVE_FILE': {
                    if (await existHashGuests(jsonMessage.hash) || await existHashUsers(jsonMessage.hash)) {
                        saveFile(jsonMessage.hash, jsonMessage.filename, jsonMessage.data, jsonMessage.raw_string);
                        //`File saved successfully`
                        wsClient.send(JSON.stringify({ action: "SAVE_FILE_OK", data: 'Файл сохранён успешно', filename: jsonMessage.filename }));
                    } else {
                        //`You didn't authenticate, please refresh page`
                        wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: 'Вы не аутентифицированы, пожалуйста перезагрузите страницу. ' }));
                    }
                    break;
                }

                case 'GET_FILE': {
                    let file = await getFile(jsonMessage.filename, jsonMessage.hash);
                    wsClient.send(JSON.stringify({ action: 'TAKE_FILE', raw_string: JSON.stringify(file) }))
                    break;
                }

                case 'GET_ALL_FILES': {
                    if (await existHashGuests(jsonMessage.hash) || await existHashUsers(jsonMessage.hash)) {
                        let res = await db.query('SELECT nickname FROM users WHERE passhash = $1', [jsonMessage.hash]);
                        wsClient.send(JSON.stringify({
                            action: "TAKE_ALL_FILES"
                            , files: JSON.stringify(await getAllFiles(jsonMessage.hash))
                        }));
                    } else {
                        //`You didn't authenticate, please refresh page`
                        wsClient.send(JSON.stringify({ action: "TOKEN_NOT_VALID", data: 'Вы не аутентифицированы, пожалуйста перезагрузите страницу. ' }));
                    }
                    break;
                }

                case 'DELETE_FILE': {
                    deleteFile(jsonMessage.filename, jsonMessage.hash);
                    wsClient.send(JSON.stringify({ action: 'DELETE_SUCCESSFUL', filename: jsonMessage.filename }))
                    break;
                }
                case 'NEW_GUEST': {
                    let sugar = Date.now().toString();
                    let hash = get_hash(sugar, sugar);
                    insertGuest(hash, 86400);
                    wsClient.send(JSON.stringify({ action: 'NEW_GUEST_REGISTRATION_OK', hash: hash }))
                    break;
                }
                case 'SIGNUP': {
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
                }
                case 'AUTH_COOKIE': {
                    if (await existHashUsers(jsonMessage.hash)) {
                        //give all files, give another tabs
                        let res = await db.query('SELECT nickname FROM users WHERE passhash = $1', [jsonMessage.hash])
                        wsClient.send(JSON.stringify({
                            action: "AUTH_OK"
                            , nickname: res.rows[0]
                            , files: JSON.stringify(await getAllFiles(jsonMessage.hash))
                            , lessons: JSON.stringify(await getLessons())
                            , tasks: JSON.stringify(await getTasks())
                        }))
                    } else if (await existHashGuests(jsonMessage.hash)) {
                        //console.log('getAllFiles: ' + gAF + '\n' + gAF.rows[0])
                        wsClient.send(JSON.stringify({
                            action: "GUEST_AUTH_OK"
                            , files: JSON.stringify(await getAllFiles(jsonMessage.hash))
                            , lessons: JSON.stringify(await getLessons())
                            , tasks: JSON.stringify(await getTasks())
                        }))
                    } else {
                        //`You didn't authenticate, please refresh page`
                        wsClient.send(JSON.stringify({ action: "TOKEN_NOT_VALID", data: 'Вы не аутентифицированы, пожалуйста перезагрузите страницу. ' }));
                    }
                    break;
                }
                case 'AUTH_LOGIN': {
                    let new_hash = get_hash(jsonMessage.login, jsonMessage.password);
                    if (await existLogin(jsonMessage.login) && await existHashUsers(new_hash)) {
                        wsClient.send(JSON.stringify({ action: "LOGIN_CORRECT", hash: new_hash }))
                    }
                    else {
                        wsClient.send(JSON.stringify({ action: "LOGIN_INCORRECT" }))
                    }
                    break;
                }
                case 'COMPILE_CODE': {
                    let jsnmData = new String(jsonMessage.data);
                    //console.log(data.toString());
                    console.log(jsnmData.action);
                    console.log(jsnmData.data);
                    console.log(jsnmData.hash);
                    console.log(jsnmData.filename);
                    console.log(jsnmData.stdin);

                    if (jsonMessage.hash === 'undefined' || (!existHashUsers(jsonMessage.hash) && !existHashGuests(jsonMessage.hash))) {
                        //`You didn't authenticate, please refresh page`
                        wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: 'Вы не аутентифицированы, пожалуйста перезагрузите страницу. ' }));
                        break;
                    }
                    let filename;
                    if (jsonMessage.filename == '') {
                        let rowcount = await getAllFiles(jsonMessage.hash);
                        filename = rowcount.rowCount;
                    } else {
                        filename = jsonMessage.filename;
                        filename = filename.split('.')[0];
                    }
                    console.log('filename: ' + filename + ' filenameJson: ' + jsonMessage.filename)

                    exec(`mkdir -p ./user_data/${jsonMessage.hash} && echo "${jsonMessage.data.toString()}" > ./user_data/${jsonMessage.hash}/${filename}.pas`, (error, stdout, stderr) => {
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

                    exec(`mono ${pabcexePath} ./user_data/${jsonMessage.hash}/${filename}.pas ./user_data/${jsonMessage.hash}/${filename}.exe`, (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                            console.log(`stdout: ${stdout}`);
                            let splitedError = stdout.split('\n');
                            wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: splitedError[9] })); //stdout.slice(341)
                        }
                        if (stderr) {
                            console.log(`stderr: ${stderr}`);
                        }
                        if (!error) {
                            /*processQueue.push([`./user_data/${jsonMessage.hash}/${filename}.exe`]);
                            processQueue.push(jsonMessage);
                            processQueue.push(wsClient);
                            processQueue.push(filename);*/

                            let stdData = '';
                            let child = spawn(`mono`, [`./user_data/${jsonMessage.hash}/${filename}.exe`], { timeout: 10000 });
                            child.stdin.setDefaultEncoding('utf-8');
                            child.stdin.write(jsonMessage.stdin + '\r\n');
                            child.stdout.on('data', (data) => {
                                console.log(`stdout: ${data}`);
                                stdData += data;
                                //pidusage(child.pid, function (err, stats) { console.log(stats); });
                                //console.log(child.memoryUsage())
                            });
                            child.stderr.on('data', (error) => {
                                console.log('child error: ' + error)
                                wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: error.toString() }));
                            });
                            child.on('close', (code) => {
                                child.stdin.end();
                                child.stdout.end();
                                child.stderr.end();
                                if (code !== 0) {
                                    console.log(`grep process exited with code ${code}`);
                                }
                                wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: stdData }));
                                console.log('send data: ', stdData)
                                saveFile(jsonMessage.hash, filename + '.pas', jsonMessage.data, jsonMessage.raw_string);
                            });

                            /*let timeout = setTimeout(() => {
                                console.log('Timeout by user: ' + jsonMessage.hash)
                                try {
                                    console.log('Try kill by pid: ' + child.pid + ' ' + -child.pid);
                                    process.kill(child.pid, 'SIGKILL');
                                } catch (e) {
                                    console.log('Cannot kill process: ' + e);
                                }
                            }, 10000);*/

                            /*exec(`mono ./user_data/${jsonMessage.hash}/${filename}.exe`, (error, stdout, stderr) => {
                                if (error) {
                                    console.log(`error: ${error.message}`);
                                }
                                if (stderr) {
                                    console.log(`stderr: ${stderr}`);
                                }
                                console.log(`stdout: ${stdout}`);
                                wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: stdout }));
                                saveFile(jsonMessage.hash, filename, jsonMessage.data, jsonMessage.raw_string);
                                //wsClient.send(stdout);
                            });*/
                        }
                    });
                    break;
                }//end case: 'CODE'

                case 'CHECK_TASK': {
                    let jsnmData = new String(jsonMessage.data);

                    if (jsonMessage.hash === 'undefined' || (!existHashUsers(jsonMessage.hash) && !existHashGuests(jsonMessage.hash))) {
                        //`You didn't authenticate, please refresh page`
                        wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: 'Вы не аутентифицированы, пожалуйста перезагрузите страницу. ' }));
                        break;
                    }
                    let filename;
                    if (jsonMessage.filename == '') {
                        let rowcount = await getAllFiles(jsonMessage.hash);
                        filename = rowcount.rowCount;
                    } else {
                        filename = jsonMessage.filename;
                        filename = filename.split('.')[0];
                    }
                    console.log('filename: ' + filename + ' filenameJson: ' + jsonMessage.filename)

                    exec(`mkdir -p ./user_data/${jsonMessage.hash} && echo "${jsonMessage.data.toString()}" > ./user_data/${jsonMessage.hash}/${filename}.pas`, (error, stdout, stderr) => {
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

                    exec(`mono ${pabcexePath} ./user_data/${jsonMessage.hash}/${filename}.pas ./user_data/${jsonMessage.hash}/${filename}.exe`, async (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                            console.log(`stdout: ${stdout}`);
                            let splitedError = stdout.split('\n');
                            wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: splitedError[9] })); //stdout.slice(341)
                        }
                        if (stderr) {
                            console.log(`stderr: ${stderr}`);
                        }
                        if (!error) {
                            /*var task = await getOneTask(jsonMessage.task_id);
                            var checkNumber = 0;
                            var length = task.rows[0].testdata.length;
                            var child;
                            var stdoutput;*/
                            //for (var iter in task.rows[0].testdata) {
                                //await spawnTask(iter, task, jsonMessage, filename);
                                /*let stdData = '';
                                let child = spawn(`mono`, [`./user_data/${jsonMessage.hash}/${filename}.exe`], { timeout: 10000 });
                                child.stdin.setDefaultEncoding('utf-8');
                                child.stdin.write(iter);
                                child.stdout.once('data', (data) => {
                                    console.log(`stdout: ${data}`);
                                    stdData += data;
                                    //pidusage(child.pid, function (err, stats) { console.log(stats); });
                                    //console.log(child.memoryUsage())
                                });
                                child.stderr.on('data', (error) => {
                                    console.log('child error: ' + error)
                                    wsClient.send(JSON.stringify({ action: "TASK_COMPLETE_ANSWER", data: error.toString() }));
                                });
                                child.on('close', (code) => {
                                    child.stdin.end();
                                    child.stdout.end();
                                    child.stderr.end();
                                    if (code !== 0) {
                                        console.log(`grep process exited with code ${code}`);
                                    }
                                    if (stdData == task.rows[0].testdata[iter]) {
                                        console.log('task #%d completed', checkNumber)
                                        checkNumber++;

                                        if (checkNumber === length) {
                                            wsClient.send(JSON.stringify({ action: "TASK_COMPLETE_ANSWER", data: 'Все тесты пройдены' }));
                                        }
                                    } else {
                                        console.log('stdout type: ', + typeof (stdData), 'isbuffer? ' + isBuffer(stdData) + 'isNaN ' + isNaN(stdData))
                                        console.log(`task #${checkNumber} uncompleted ${stdData} != ${task.rows[0].testdata[iter]} with ${iter}`);
                                        wsClient.send(JSON.stringify({ action: "TASK_COMPLETE_ANSWER", data: `Тест #${checkNumber} не пройден` }));
                                    }
                                });
                                */
                                

                            //}
                            let task = await getOneTask(jsonMessage.task_id);
                            let checkNumber = 0;
                            for (let iter in task.rows[0].testdata) {
                                console.log('qwerty: ' + typeof (task.rows[0].testdata[iter]));
                                let stdData = '';
                                let child = spawnSync(`mono`, [`./user_data/${jsonMessage.hash}/${filename}.exe`], { timeout: 10000, input: iter });
                                if (child.stdout == task.rows[0].testdata[iter]) {
                                    console.log('task #%d completed', checkNumber)
                                    checkNumber++;
                                } else {
                                    console.log('task #%d uncompleted %d != %d with %d', checkNumber, child.stdout, task.rows[0].testdata[iter], iter);
                                    wsClient.send(JSON.stringify({ action: "TASK_COMPLETE_ANSWER", data: `Тест #${checkNumber} не пройден` }));
                                    break;
                                }
                            }
                            if (checkNumber === 3) {
                                wsClient.send(JSON.stringify({ action: "TASK_COMPLETE_ANSWER", data: 'Все тесты пройдены' }));
                            }
                            
                        }//end if (!error) 
                    }); //end exec
                }//end case: 'CHECK_TASK'
            }//end switch
        } catch (error) {
            console.log('Ошибка: ', error);
        }
        console.log(`Сообщение обработана за: ${Date.now() - startTime} ms`)

    });//end wsClient.on('message')
    wsClient.on('close', function () {
        console.log('Пользователь отключился');
    });
}
/*var processQueue = [];
async function spawnProcessQueue() { //на какой клиент будет отсылаться результат?
    setInterval(() => {
        if (os.freemem > 134217728) {
            if (processQueue[0] && processQueue[1]) {
                let args = processQueue.shift();
                let jsonMessage = processQueue.shift();
                let wsClient = processQueue.shift();
                let filename = processQueue.shift();
                let stdData = '';
                let child = spawn('mono', args);
                child.stdin.setDefaultEncoding('utf-8');
                child.stdin.write(jsonMessage.stdin + '\r\n');
                child.stdout.on('data', (data) => {
                    console.log(`stdout: ${data}`);
                    stdData += data;
                    pidusage(child.pid, function (err, stats) { console.log(stats); });
                });
                child.stderr.on('data', (error) => {
                    console.log('child error: ' + error)
                });
                child.on('error', (error) => {
                    console.log('CHild process error: ' + error)
                });
                child.on('close', (code) => {
                    child.stdin.end();
                    child.stdout.end();
                    child.stderr.end();
                    if (code !== 0) {
                        console.log(`grep process exited with code ${code}`);
                    }
                    wsClient.send(JSON.stringify({ action: "COMPILER_ANSWER", data: stdData }));
                    console.log('send data: ', stdData)
                    saveFile(jsonMessage.hash, filename, jsonMessage.data, jsonMessage.raw_string);
                });
            }
        };
    }, 1000);
};*/

async function spawnTask(iter, task, jsonMessage, filename) {
    console.log('qwerty: ' + typeof (task.rows[0].testdata[iter]) + task.rows[0].testdata[iter] + ' ' + iter);
    var child = spawnSync(`mono`, [`./user_data/${jsonMessage.hash}/${filename}.exe`], { timeout: 10000, input: iter, encoding: 'utf8' });
    var stdoutput = child.output[1];
    //stdoutput = stdoutput.toString('utf-8');
    console.log('all output ' + child.output + ' blya ' + child.output[1] + typeof (child.output[1]) + typeof (stdoutput) + ' ' + typeof (child) + ' ' + child)
    /*if (stdoutput == task.rows[0].testdata[iter]) {
        console.log('task #%d completed', checkNumber)
        checkNumber++;
    } else {
        console.log('stdout type: ', + typeof (stdoutput), 'isbuffer? ' + isBuffer(stdoutput) + 'isNaN ' + isNaN(stdoutput))
        console.log(`task #${checkNumber} uncompleted ${stdoutput} != ${task.rows[0].testdata[iter]} with ${iter}`);
        wsClient.send(JSON.stringify({ action: "TASK_COMPLETE_ANSWER", data: `Тест #${checkNumber} не пройден` }));
        //break;
    };*/
    JSON.parse(child.output[1].toLowerCase()) == JSON.parse(task.rows[0].testdata[iter].toLowerCase()) ? console.log('True') : console.log("false");
    console.log(`task #{checkNumber} uncompleted ${stdoutput} != ${task.rows[0].testdata[iter]} with ${iter}`);

    console.log('stdout type: ' + typeof (stdoutput) + ' output: ' + child.output[1] +  'isbuffer? ' + isBuffer(stdoutput) + 'isNaN ' + isNaN(stdoutput))
    /*if (checkNumber === length) {
        wsClient.send(JSON.stringify({ action: "TASK_COMPLETE_ANSWER", data: 'Все тесты пройдены' }));
    }*/
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
    let query_text = 'SELECT nickname FROM users WHERE nickname = $1';
    let res = await db.query(query_text, [nick.toString()]);

    console.log('aaaaaaaaaaaaaaa: ' + res.rows[0] + " nick: " + nick)
    try {
        return res.rows[0].nickname === nick ? true : false
    } catch (e) {
        console.log('catch exists error: ' + e)
        return false
    }
    return res.rowCount == 1 ? true : false;
}

async function saveFile(passhash, filename, code, raw_string) {
    let query_text_update = 'UPDATE files SET code = $1, raw_string = $2 WHERE passhash = $3 AND filename = $4 returning filename';
    res = await db.query(query_text_update, [code, raw_string, passhash, filename]);
    if (res.rowCount == 1) {
        return res;
    } else if (res.rowCount == 0) {
        let query_text = 'INSERT INTO files (passhash, filename, code, raw_string) VALUES ($1, $2, $3, $4)';
        return await db.query(query_text, [passhash, filename, code, raw_string]);
    }
}

async function existHashUsers(hash) {
    let query_text = 'SELECT nickname FROM users WHERE passhash = $1';
    let res = await db.query(query_text, [hash.toString()]);
    console.log('aaaaaa users: ' + res.rows[0] + " nick: " + res.rows[0])
    return res.rowCount == 1 ? true : false;
}

async function existHashGuests(hash) {
    let query_text = 'SELECT hash FROM guests WHERE hash = $1';
    let res = await db.query(query_text, [hash.toString()]);

    console.log('aaaaa guests: ' + res.rows[0])
    return res.rowCount == 1 ? true : false;
}

async function getFile(filename, hash) {
    let query_text = 'SELECT raw_string FROM files WHERE passhash = $1 AND filename = $2';
    return await db.query(query_text, [hash, filename]);
}
async function getAllFiles(hash) {
    let query_text = 'SELECT filename, code, raw_string FROM files WHERE passhash = $1';
    return await db.query(query_text, [hash]);
}
async function deleteFile(filename, hash) {
    let query_text = 'DELETE FROM files WHERE passhash = $1 AND filename = $2';
    return await db.query(query_text, [hash, filename]);
}
async function signupUser(login, hash, privileges) {
    let query_text = 'insert into users (passhash, nickname, privileges) values ($1, $2, $3)';
    return await db.query(query_text, [hash, login, privileges]);
}

async function getLessons() {
    let query_text = 'SELECT * FROM lessons';
    return await db.query(query_text);
}

async function getTasks() {
    let query_text = 'SELECT * FROM tasks';
    return await db.query(query_text);
}

async function getOneTask(task_id) {
    let query_text = 'SELECT * FROM tasks WHERE task_id = $1';
    return await db.query(query_text, [task_id]);
}

const report = () => {
    global.gc();
    const rss = process.memoryUsage().rss / 1024 / 1024;
    let heap = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log('clients: %d, rss: %d, heap %d', wsServer.clients.size, rss, heap);
};

const takeMemoryLimit = () => {
    exec(`cat /sys/fs/cgroup/memory/memory.limit_in_bytes`, (error, stdout, stderr) => {
        console.log('memoryLimit: %d', stdout)
        return parseInt(stdout);
    })
};

setInterval(report, 30000);
report();
var memoryLimit = takeMemoryLimit();
//spawnProcessQueue();

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
