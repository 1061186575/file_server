const path = require('path');
/**
 * 运行配置
 */

// 登录系统的账号密码
const systemUser = "zp"
const systemPassword = "xxx";

// 运行端口
const port = 3008

// 保存上传文件的目录
const uploadDir = path.join(process.cwd(), 'uploads/')

// 保存登录信息的日志文件
const login_info_path = path.join(process.cwd(), "log", 'login_info.log')

/**
 * 运行配置 --- end
 */

module.exports = {
    port,
    systemUser,
    systemPassword,
    uploadDir,
    login_info_path
}