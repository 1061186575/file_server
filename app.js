const http = require('http');
const path = require('path');
const fs = require('fs');


const {
    port,
    uploadDir
} = require('./config/config.js')

const {
    identityVerify,
    cookieVerify,
    getAllFileInfo,
    uploadFile,
    deleteFile,
    modifyTextFile
} = require('./control/control');




// 如果uploadDir目录不存在就创建目录
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir)
}

// 发送页面
function sendPage(res, path, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'text/html;charset=UTF-8' });
    fs.createReadStream(path).pipe(res)
}

// 文件不存在返回404
function handle404(res, fileDir) {
    if (!fs.existsSync(fileDir)) {
        res.writeHead(404, { 'content-type': 'text/html;charset=UTF-8' });
        res.end("404, no such file or directory");
        console.log("no such file or directory: ", fileDir);
        return true; // 处理成功
    }
    return false
}

var server = http.createServer(function(req, res) {

    let url = decodeURI(req.url);
    console.log("url: ", url);

    let method = req.method.toLowerCase()

    let parameterPosition = url.indexOf('?')
    if (parameterPosition > -1) {
        url = url.slice(0, parameterPosition) // 去掉url中的参数部分
        console.log("去掉参数后的url: ", url);
    }

    // 访问public接口时发送public目录下的文件, 不需要任何验证
    if (/^\/public\//.test(url)) {
        let fileDir = '.' + url;
        if (!handle404(res, fileDir)) {
            fs.createReadStream(fileDir).pipe(res)
        }
        return;
    }

    // 身份验证的接口
    if (url === '/identityVerify' && method === 'post') {
        identityVerify(req, res)
        return;
    }

    // cookie验证, 如果验证不成功, 就只发送verify.html
    if (!cookieVerify(req.headers.cookie)) {
        sendPage(res, './public/verify.html', 400);
        return;
    }


    if (url === '/' && method === 'get') {

        sendPage(res, './index.html');

    } else if (url === '/getAllFileInfo' && method === 'get') {

        // 读取uploadDir目录下的文件信息并返回
        getAllFileInfo(req, res)

    } else if (url === '/uploadFile' && method === 'post') {

        // 上传文件
        uploadFile(req, res)

    } else if (/^\/deleteFile?/.test(url) && method === 'get') {

        // 删除文件
        deleteFile(req, res)

    } else if (/^\/modifyTextFile?/.test(url) && method === 'post') {

        // 修改文本文件
        modifyTextFile(req, res)

    } else {

        // 下载文件, 默认发送uploads目录下的文件
        let fileDir = path.join(uploadDir, url);
        if (!handle404(res, fileDir)) {
            console.log("下载文件: ", fileDir);
            fs.createReadStream(fileDir).pipe(res)
        }

    }




})

server.listen(port);
console.log('running port:', port)



// 异常处理
process.on("uncaughtException", function(err) {
    if (err.code == 'ENOENT') {
        console.log("no such file or directory: ", err.path);
    } else {
        console.log(err);
    }
})


process.on("SIGINT", function() {
    process.exit()
})
process.on("exit", function() {
    console.log("exit");
})