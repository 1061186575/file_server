const fs = require('fs');
const formidable = require('formidable')

const {
    systemUser,
    systemPassword,
    uploadDir,
    login_info_path
} = require('../config/config.js')



const log = console.log;
let login_info_writeStream = fs.createWriteStream(login_info_path, { flags: 'a' })


//通过req的hearers来获取客户端ip
function getIp(req) {
    let ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddres || req.socket.remoteAddress || '';
    return ip;
}


// 验证账号密码, 验证成功则设置cookie, 验证结果写入到login_info.log日志文件里
function identityVerify(req, res) {

    let clientIp = getIp(req);
    console.log('客户端ip: ', clientIp);

    let verify_str = ''
    req.on('data', function(verify_data) {
        verify_str += verify_data;
    })
    req.on('end', function() {
        let verify_obj = {};
        try {
            verify_obj = JSON.parse(verify_str)
        } catch (e) {
            console.log(e);
        }
        log("verify_obj", verify_obj)

        res.writeHead(200, {
            'Content-Type': 'text/plain;charset=UTF-8'
        });

        // 保存登录信息日志
        login_info_writeStream.write("Time: " + new Date().toLocaleString() + '\n')
        login_info_writeStream.write("IP地址: " + clientIp + '\n')

        if (verify_obj.user === systemUser && verify_obj.password === systemPassword) {
            // 验证成功
            log("验证成功")

            login_info_writeStream.write("User: " + verify_obj.user + '\n验证成功\n\n')

            // 设置cookie, 过期时间2小时
            res.writeHead(200, {
                'Set-Cookie': verify_obj.user + "=" + verify_obj.password + ";path=/;expires=" + new Date(Date.now() + 1000 * 60 * 60 * 2).toGMTString(),
            });
            res.end(JSON.stringify({ code: 0, msg: "验证成功" }));

        } else {
            // 验证失败
            login_info_writeStream.write("User: " + verify_obj.user + "\t\t\t\tPassword: " + verify_obj.password + '\n验证失败\n\n')
            res.end(JSON.stringify({ code: 1, msg: "验证失败" }));
        }

    })
}




// 把cookie拆分成数组
function cookiesSplitArray(cookies) {
    // let cookies = req.headers.cookie;
    let cookieArray = [];
    if (cookies) {
        cookieArray = cookies.split(';')
    }
    return cookieArray;
}

// 把单个cookie的键值拆开
function cookieSplitKeyValue(cookie) {
    if (!cookie) return {};
    let KeyValue = cookie.trim().split('=');
    const cookie_key = KeyValue[0];
    const cookie_value = KeyValue[1];
    return { cookie_key, cookie_value }
}

// cookie验证
// 如果cookie中有一对键值等于系统登录的账号密码, 就认为验证成功(验证失败最多只能获得public目录下的文件)
function cookieVerify(cookies) {
    const cookieArray = cookiesSplitArray(cookies)

    // 新增的cookie一般在最后, 因此数组从后往前遍历
    for (let index = cookieArray.length; index >= 0; index--) {
        const item = cookieArray[index];
        // let itemCookie = item.trim().split('=');
        // const cookie_key = itemCookie[0];
        // const cookie_value = itemCookie[1];
        const { cookie_key, cookie_value } = cookieSplitKeyValue(item);

        if (cookie_key === systemUser && cookie_value === systemPassword) {
            return true;
        }
    }

    return false;
}



// 读取uploadDir目录下的文件信息并返回
function getAllFileInfo(req, res) {
    fs.readdir(uploadDir, (err, data) => {
        // console.log(data);
        let resultArray = [];
        for (let d of data) {
            let statSyncRes = fs.statSync(uploadDir + d);
            // console.log("statSyncRes", statSyncRes)
            resultArray.push({
                src: d,
                size: statSyncRes.size,
                //mtimeMs: statSyncRes.mtimeMs,  // 我发现有些电脑上的文件没有mtimeMs属性, 所以将mtime转成时间戳发过去
                mtimeMs: new Date(statSyncRes.mtime).getTime()
            })
        }
        // console.log(resultArray);
        res.end(JSON.stringify(resultArray))
    })
}


// 上传文件
function uploadFile(req, res) {
    console.log("上传文件");

    var form = new formidable.IncomingForm();
    form.uploadDir = uploadDir; // 保存上传文件的目录
    form.multiples = true; // 设置为多文件上传
    form.keepExtensions = true; // 保持原有扩展名
    form.maxFileSize = 10 * 1024 * 1024 * 1024; // 文件最大为10GB

    // 文件大小超过限制会触发error事件
    form.on("error", function(e) {
        console.log("文件大小超过限制, error: ", e);
        res.writeHead(400, { 'content-type': 'text/html;charset=UTF-8' });
        res.end("文件大小超过10GB, 无法上传, 你难道不相信?")
    })


    form.parse(req, function(err, fields, files) {

        if (err) {
            console.log("err: ", err);
            res.writeHead(500, { 'content-type': 'text/html;charset=UTF-8' });
            res.end('上传文件失败: ' + JSON.stringify(err));
            return;
        }

        // console.log(files);
        // console.log(files.uploadFile);

        if (!files.uploadFile) {
            res.end('上传文件的name需要为uploadFile');
            return
        };


        // 单文件上传时files.uploadFile为对象类型, 多文件上传时为数组类型, 
        // 单文件上传时也将files.uploadFile变成数组类型当做多文件上传处理;
        if (Object.prototype.toString.call(files.uploadFile) === '[object Object]') {

            files.uploadFile = [files.uploadFile];
            // var fileName = files.uploadFile.name; // 单文件上传时直接.name就可以得到文件名

        }


        let err_msg = ''
        for (let file of files.uploadFile) {
            var fileName = file.name;

            console.log("上传文件名: ", fileName);


            var suffix = fileName.slice(fileName.lastIndexOf('.'));

            var oldPath = file.path;
            var newPath = uploadDir + fileName;

            // log(oldPath)
            // log(newPath)


            // 如果不允许覆盖同名文件
            if (fields.allowCoverage !== 'true') {
                // 并且文件已经存在，那么在文件后面加上时间戳再加文件后缀
                if (fs.existsSync(newPath)) {
                    newPath = newPath + '-' + Date.now() + suffix;
                }
            }

            // 文件会被formidable自动保存, 而且文件名随机, 因此保存后需要改名
            fs.rename(oldPath, newPath, function(err) {
                if (err) {
                    console.log("err: ", err);
                    err_msg += JSON.stringify(err) + '\n';
                }
            })
        }

        //res.writeHead(200, { 'content-type': 'text/plain;charset=UTF-8' });
        // res.writeHead(301, { 'Location': '/' });
        res.end(err_msg);

    });
}


// 根据文件名删除文件
function deleteFile(req, res) {
    let url = decodeURI(req.url);
    let fileName = url.slice(url.indexOf('?') + 1);
    console.log("删除文件: ", fileName)

    fs.unlink(uploadDir + fileName, (err) => {
        if (err) {
            console.log(err);
            res.end('delete fail: ' + JSON.stringify(err));
            return;
        }
        res.end();
    });
}


// 根据文件名和数据修改(覆盖)文本文件
function modifyTextFile(req, res) {
    let url = decodeURI(req.url);
    let fileName = url.slice(url.indexOf('?') + 1);
    console.log("修改(覆盖)文本文件: ", fileName)

    let WriteStream = fs.createWriteStream(uploadDir + fileName)

    WriteStream.on('error', function(err) {
        res.end(JSON.stringify({ code: 1, msg: JSON.stringify(err) }))
    })

    WriteStream.on('finish', function() {
        res.end(JSON.stringify({ code: 0, msg: "保存成功" }))
    })

    req.on('data', function(data) {
        WriteStream.write(data)
    })

    req.on('end', function() {
        WriteStream.end()
        WriteStream.close()
    })
}



module.exports = {
    identityVerify,
    cookieVerify,
    getAllFileInfo,
    uploadFile,
    deleteFile,
    modifyTextFile
}