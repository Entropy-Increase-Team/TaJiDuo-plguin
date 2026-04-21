import { joinLines } from './common.js'
import { formatCommand } from './command.js'

const LOGIN_COMMAND_EXAMPLE = formatCommand('塔吉多登录 13800138000')
const AUTH_EXPIRED_MESSAGE = '当前 fwt 已失效，请重新登录'

function getErrorMessage (error) {
  return String(error?.message || error || '').trim()
}

function isAuthExpiredError (error) {
  const message = getErrorMessage(error)
  return error?.isAuthError === true ||
    Number(error?.responseStatus) === 401 ||
    Number(error?.responseCode) === 401 ||
    message.includes(AUTH_EXPIRED_MESSAGE)
}

function buildReloginReply (title = '', message = AUTH_EXPIRED_MESSAGE) {
  return joinLines([
    title,
    `结果：${message}`,
    `请重新发送 ${LOGIN_COMMAND_EXAMPLE}`
  ])
}

export {
  AUTH_EXPIRED_MESSAGE,
  LOGIN_COMMAND_EXAMPLE,
  buildReloginReply,
  getErrorMessage,
  isAuthExpiredError
}
