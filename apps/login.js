import { randomBytes } from 'node:crypto'
import plugin from '../../../lib/plugins/plugin.js'
import TaJiDuoApi from '../model/api.js'
import { clearUserSession, getUserSession, saveUserSession } from '../model/store.js'
import Config from '../utils/config.js'
import { joinLines, normalizePositiveInt } from '../utils/common.js'
import { buildCommandReg, formatCommand } from '../utils/command.js'

const PLATFORM_ALIAS = '(?:TaJiDuo|tajiduo|TAJIDUO|塔吉多)'
const LOGIN_COMMAND_REG = buildCommandReg(`${PLATFORM_ALIAS}登(?:录|陆)(?:\\s+.+)?`)
const REFRESH_COMMAND_REG = buildCommandReg(`${PLATFORM_ALIAS}(?:刷新登录|刷新会话|刷新)`)
const ACCOUNT_COMMAND_REG = buildCommandReg(`${PLATFORM_ALIAS}(?:账号|会话|状态)`)
const LOGOUT_COMMAND_REG = buildCommandReg(`${PLATFORM_ALIAS}(?:退出登录|退登|登出|退出)`)
const DELETE_ACCOUNT_COMMAND_REG = buildCommandReg(`${PLATFORM_ALIAS}删除账号`)
const CAPTCHA_MESSAGE_REG = '^\\d{6}$'
const DEFAULT_CAPTCHA_WAIT_TIMEOUT_MS = 300000
const PENDING_LOGIN_MAP = new Map()
const AUTH_EXPIRED_MESSAGE = '当前 fwt 已失效，请重新登录'

function maskPhone (phone = '') {
  const text = String(phone || '').trim()
  if (!text) return '未填写'
  if (text.length < 7) return text
  return `${text.slice(0, 3)}****${text.slice(-4)}`
}

function isValidPhone (phone = '') {
  return /^1\d{10}$/.test(String(phone || '').trim())
}

function isValidCaptcha (captcha = '') {
  return /^\d{6}$/.test(String(captcha || '').trim())
}

function extractCommandArgs (message = '', commandPattern = '') {
  const text = String(message || '').trim()
  const matched = text.match(new RegExp(`^(?:#|=)\\s*${commandPattern}\\s*(.*)$`, 'i'))
  return String(matched?.[1] || '').trim()
}

function parseLoginArgs (message = '') {
  const args = extractCommandArgs(message, `${PLATFORM_ALIAS}登(?:录|陆)`)
  if (!args) return { phone: '', hasExtraArgs: false }

  const parts = args.split(/\s+/).filter(Boolean)
  return {
    phone: String(parts[0] || '').trim(),
    hasExtraArgs: parts.length > 1
  }
}

function buildLoginReply (session = {}) {
  return joinLines([
    '塔吉多登录成功',
    `昵称：${session.username || '未返回'}`,
    `塔吉多UID：${session.tgdUid || '未返回'}`,
    '',
    `后续可直接使用 ${formatCommand('塔吉多社区签到')}、${formatCommand('塔吉多幻塔社区签到')}、${formatCommand('塔吉多异环社区签到')}`
  ])
}

function isAuthExpiredError (error) {
  const message = String(error?.message || '').trim()
  return error?.isAuthError === true ||
    Number(error?.responseStatus) === 401 ||
    Number(error?.responseCode) === 401 ||
    message.includes(AUTH_EXPIRED_MESSAGE)
}

function buildReloginReply (title = '', message = AUTH_EXPIRED_MESSAGE) {
  return joinLines([
    title,
    `结果：${message}`,
    `请重新发送 ${formatCommand('塔吉多登录 13800138000')}`
  ])
}

function isSafeHeaderToken (value = '') {
  return /^[A-Za-z0-9._:-]+$/.test(String(value || '').trim())
}

export class TaJiDuoLogin extends plugin {
  constructor (e) {
    super({
      name: '[TaJiDuo-plugin] 登录与会话',
      dsc: 'TaJiDuo 登录与本地会话管理',
      event: 'message',
      priority: 110,
      rule: [
        { reg: LOGIN_COMMAND_REG, fnc: 'login' },
        { reg: REFRESH_COMMAND_REG, fnc: 'refreshSession' },
        { reg: ACCOUNT_COMMAND_REG, fnc: 'showSession' },
        { reg: LOGOUT_COMMAND_REG, fnc: 'logout' },
        { reg: DELETE_ACCOUNT_COMMAND_REG, fnc: 'deleteAccount' },
        { reg: CAPTCHA_MESSAGE_REG, fnc: 'consumeCaptcha' }
      ]
    })

    this.e = e
    this.api = new TaJiDuoApi()
  }

  async ensurePrivateChat (replyHint = false) {
    if (!this.e.isGroup) {
      return true
    }

    if (replyHint) {
      await this.reply('塔吉多登录相关命令仅支持私聊使用')
    }

    return false
  }

  getSessionIdentity () {
    return {
      selfId: this.e.self_id || 'bot',
      userId: this.e.user_id
    }
  }

  getPlatformIdentity () {
    const clientId = String(Config.get('tajiduo', 'client_id') || '').trim()
    const userId = String(this.e.user_id || '').trim()
    const platformId = clientId
    const platformUserId = userId

    if (!platformId) {
      throw new Error('缺少 client_id，无法创建塔吉多会话')
    }

    if (!isSafeHeaderToken(platformId)) {
      throw new Error('client_id 只能使用字母、数字、点、下划线、连字符、冒号')
    }

    if (!platformUserId) {
      throw new Error('缺少平台用户 ID，无法创建塔吉多会话')
    }

    return {
      platformId,
      platformUserId
    }
  }

  getPendingKey () {
    const { selfId, userId } = this.getSessionIdentity()
    return `${selfId}:${String(userId || '').trim()}`
  }

  getCaptchaWaitTimeoutMs () {
    return normalizePositiveInt(Config.get('tajiduo', 'captcha_wait_timeout_ms')) || DEFAULT_CAPTCHA_WAIT_TIMEOUT_MS
  }

  generateDeviceId () {
    return randomBytes(16).toString('hex')
  }

  getPendingLogin () {
    const session = PENDING_LOGIN_MAP.get(this.getPendingKey())
    if (!session) return null

    if (Date.now() > Number(session.expiresAt || 0)) {
      PENDING_LOGIN_MAP.delete(this.getPendingKey())
      return null
    }

    return session
  }

  savePendingLogin (payload = {}) {
    PENDING_LOGIN_MAP.set(this.getPendingKey(), payload)
    return payload
  }

  clearPendingLogin () {
    PENDING_LOGIN_MAP.delete(this.getPendingKey())
  }

  async login () {
    if (!(await this.ensurePrivateChat(true))) {
      return true
    }

    const { phone, hasExtraArgs } = parseLoginArgs(this.e.msg)

    if (!isValidPhone(phone) || hasExtraArgs) {
      await this.reply(`格式：${formatCommand('塔吉多登录 13800138000')}`)
      return true
    }

    await this.sendCaptchaAndWait(phone)
    return true
  }

  async consumeCaptcha () {
    if (this.e.isGroup) {
      return false
    }

    const pending = this.getPendingLogin()
    if (!pending) {
      return false
    }

    const captcha = String(this.e.msg || '').trim()
    if (!isValidCaptcha(captcha)) {
      return false
    }

    await this.loginWithCaptcha(pending.phone, captcha, pending.deviceId)
    return true
  }

  async sendCaptchaAndWait (phone = '') {
    const fallbackDeviceId = this.generateDeviceId()
    const data = await this.api.sendCaptcha({
      phone,
      deviceId: fallbackDeviceId
    })
    const deviceId = String(data?.deviceId || fallbackDeviceId).trim() || fallbackDeviceId

    this.savePendingLogin({
      phone,
      deviceId,
      expiresAt: Date.now() + this.getCaptchaWaitTimeoutMs()
    })

    await this.reply(joinLines([
      `验证码已发送到 ${maskPhone(phone)}`,
      '请直接发送下一条 6 位验证码完成登录。'
    ]))
  }

  async loginWithCaptcha (phone = '', captcha = '', deviceId = '') {
    try {
      const platformIdentity = this.getPlatformIdentity()
      const data = await this.api.createSession({
        phone,
        captcha,
        deviceId: String(deviceId || '').trim() || this.generateDeviceId()
      }, platformIdentity)

      const { selfId, userId } = this.getSessionIdentity()
      const session = await saveUserSession(selfId, userId, data)
      this.clearPendingLogin()

      await this.reply(buildLoginReply(session))
      return true
    } catch (error) {
      await this.reply(`塔吉多登录失败：${error.message || error}`)
      return true
    }
  }

  async showSession () {
    if (!(await this.ensurePrivateChat(true))) {
      return true
    }

    try {
      const { selfId, userId } = this.getSessionIdentity()
      const session = await getUserSession(selfId, userId)

      if (!session?.fwt) {
        await this.reply(`当前还没有已登录账号，请先发送 ${formatCommand('塔吉多登录 13800138000')}`)
        return true
      }

      await this.reply(joinLines([
        '当前塔吉多账号',
        `昵称：${session.username || '未返回'}`,
        `塔吉多UID：${session.tgdUid || '未返回'}`
      ]))
      return true
    } catch (error) {
      await this.reply(`查询账号失败：${error.message || error}`)
      return true
    }
  }

  async refreshSession () {
    if (!(await this.ensurePrivateChat(true))) {
      return true
    }

    try {
      const { selfId, userId } = this.getSessionIdentity()
      const session = await getUserSession(selfId, userId)

      if (!session?.fwt) {
        throw new Error(`当前还没有已登录账号，请先发送 ${formatCommand('塔吉多登录 13800138000')}`)
      }

      const data = await this.api.refreshSession({ fwt: session.fwt })
      const next = await saveUserSession(selfId, userId, {
        username: session.username,
        tgdUid: data?.tgdUid || session.tgdUid,
        fwt: data?.fwt || session.fwt
      })

      await this.reply(joinLines([
        '塔吉多登录刷新完成',
        `结果：${data?.success === false ? '失败' : '成功'} | ${data?.message || '刷新完成'}`,
        `昵称：${next.username || '未返回'}`,
        `塔吉多UID：${next.tgdUid || '未返回'}`
      ]))
      return true
    } catch (error) {
      if (isAuthExpiredError(error)) {
        const { selfId, userId } = this.getSessionIdentity()
        await clearUserSession(selfId, userId)
        this.clearPendingLogin()
        await this.reply(buildReloginReply('塔吉多登录刷新失败', error.message || AUTH_EXPIRED_MESSAGE))
        return true
      }

      await this.reply(`塔吉多登录刷新失败：${error.message || error}`)
      return true
    }
  }

  async logout () {
    if (!(await this.ensurePrivateChat(true))) {
      return true
    }

    try {
      const { selfId, userId } = this.getSessionIdentity()
      const cleared = await clearUserSession(selfId, userId)
      this.clearPendingLogin()

      if (!cleared) {
        await this.reply('当前没有需要退出的登录账号')
        return true
      }

      await this.reply('当前塔吉多登录已退出')
      return true
    } catch (error) {
      await this.reply(`退出登录失败：${error.message || error}`)
      return true
    }
  }

  async deleteAccount () {
    if (!(await this.ensurePrivateChat(true))) {
      return true
    }

    try {
      const { selfId, userId } = this.getSessionIdentity()
      const session = await getUserSession(selfId, userId)

      if (!session?.fwt) {
        throw new Error('当前没有可删除的登录账号')
      }

      const data = await this.api.deleteAccount(session.fwt)
      await clearUserSession(selfId, userId)
      this.clearPendingLogin()

      await this.reply(joinLines([
        '塔吉多账号已删除',
        `结果：${data?.message || '删除成功'}`
      ]))
      return true
    } catch (error) {
      if (isAuthExpiredError(error)) {
        const { selfId, userId } = this.getSessionIdentity()
        await clearUserSession(selfId, userId)
        this.clearPendingLogin()
        await this.reply(buildReloginReply('删除账号失败', error.message || AUTH_EXPIRED_MESSAGE))
        return true
      }

      await this.reply(`删除账号失败：${error.message || error}`)
      return true
    }
  }
}
