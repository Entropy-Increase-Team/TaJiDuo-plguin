import { randomBytes } from 'node:crypto'
import plugin from '../../../lib/plugins/plugin.js'
import TaJiDuoApi from '../model/api.js'
import { clearUserSession, getUserSession, saveUserSession } from '../model/store.js'
import {
  AUTH_EXPIRED_MESSAGE,
  LOGIN_COMMAND_EXAMPLE,
  buildReloginReply,
  getErrorMessage,
  isAuthExpiredError
} from '../utils/auth.js'
import Config from '../utils/config.js'
import { joinLines, normalizePositiveInt } from '../utils/common.js'
import { buildCommandReg, formatCommand } from '../utils/command.js'

const PLATFORM_ALIAS = '(?:TaJiDuo|tajiduo|TAJIDUO|塔吉多)'
const NO_SESSION_REPLY = `当前还没有已登录账号，请先发送 ${LOGIN_COMMAND_EXAMPLE}`
const DEFAULT_CAPTCHA_WAIT_TIMEOUT_MS = 300000
const CAPTCHA_MESSAGE_REG = '^\\d{6}$'
const PENDING_LOGIN_MAP = new Map()
const COMMAND_REGS = Object.freeze({
  login: buildCommandReg(`${PLATFORM_ALIAS}登(?:录|陆)(?:\\s+.+)?`),
  refresh: buildCommandReg(`${PLATFORM_ALIAS}(?:刷新登录|刷新会话|刷新)`),
  account: buildCommandReg(`${PLATFORM_ALIAS}(?:账号|会话|状态)`),
  logout: buildCommandReg(`${PLATFORM_ALIAS}(?:退出登录|退登|登出|退出)`),
  deleteAccount: buildCommandReg(`${PLATFORM_ALIAS}删除账号`)
})

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

function isSafeHeaderToken (value = '') {
  return /^[A-Za-z0-9._:-]+$/.test(String(value || '').trim())
}

function extractCommandArgs (message = '', commandPattern = '') {
  const text = String(message || '').trim()
  const matched = text.match(new RegExp(`^(?:#|=)\\s*${commandPattern}\\s*(.*)$`, 'i'))
  return String(matched?.[1] || '').trim()
}

function parseLoginArgs (message = '') {
  const args = extractCommandArgs(message, `${PLATFORM_ALIAS}登(?:录|陆)`)
  if (!args) {
    return {
      phone: '',
      hasExtraArgs: false
    }
  }

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

function buildSessionSummary (title = '', session = {}, extraLines = []) {
  return joinLines([
    title,
    ...extraLines,
    `昵称：${session.username || '未返回'}`,
    `塔吉多UID：${session.tgdUid || '未返回'}`
  ])
}

export class TaJiDuoLogin extends plugin {
  constructor (e) {
    super({
      name: '[TaJiDuo-plugin] 登录与会话',
      dsc: 'TaJiDuo 登录与本地会话管理',
      event: 'message',
      priority: 110,
      rule: [
        { reg: COMMAND_REGS.login, fnc: 'login' },
        { reg: COMMAND_REGS.refresh, fnc: 'refreshSession' },
        { reg: COMMAND_REGS.account, fnc: 'showSession' },
        { reg: COMMAND_REGS.logout, fnc: 'logout' },
        { reg: COMMAND_REGS.deleteAccount, fnc: 'deleteAccount' },
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
      await this.reply('塔吉多登录命令仅支持私聊使用')
    }

    return false
  }

  getSessionIdentity () {
    return {
      selfId: this.e.self_id || 'bot',
      userId: this.e.user_id
    }
  }

  async getCurrentSession () {
    const { selfId, userId } = this.getSessionIdentity()
    return getUserSession(selfId, userId)
  }

  async requireCurrentSession (missingMessage = NO_SESSION_REPLY) {
    const session = await this.getCurrentSession()

    if (!session?.fwt) {
      throw new Error(missingMessage)
    }

    return session
  }

  async clearCurrentUserSession () {
    const { selfId, userId } = this.getSessionIdentity()
    await clearUserSession(selfId, userId)
    this.clearPendingLogin()
  }

  getPlatformIdentity () {
    const clientId = String(Config.get('tajiduo', 'client_id') || '').trim()
    const platformUserId = String(this.e.user_id || '').trim()

    if (!clientId) {
      throw new Error('缺少 client_id，无法创建塔吉多会话')
    }

    if (!isSafeHeaderToken(clientId)) {
      throw new Error('client_id 只能使用字母、数字、点、下划线、连字符、冒号')
    }

    if (!platformUserId) {
      throw new Error('缺少平台用户 ID，无法创建塔吉多会话')
    }

    return {
      platformId: clientId,
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
    const pendingLogin = PENDING_LOGIN_MAP.get(this.getPendingKey())
    if (!pendingLogin) {
      return null
    }

    if (Date.now() > Number(pendingLogin.expiresAt || 0)) {
      this.clearPendingLogin()
      return null
    }

    return pendingLogin
  }

  savePendingLogin (payload = {}) {
    PENDING_LOGIN_MAP.set(this.getPendingKey(), payload)
    return payload
  }

  clearPendingLogin () {
    PENDING_LOGIN_MAP.delete(this.getPendingKey())
  }

  async handleAuthExpired (title = '', error) {
    await this.clearCurrentUserSession()
    await this.reply(buildReloginReply(title, getErrorMessage(error) || AUTH_EXPIRED_MESSAGE))
    return true
  }

  async login () {
    if (!(await this.ensurePrivateChat(true))) {
      return true
    }

    const { phone, hasExtraArgs } = parseLoginArgs(this.e.msg)
    if (!isValidPhone(phone) || hasExtraArgs) {
      await this.reply(`格式：${LOGIN_COMMAND_EXAMPLE}`)
      return true
    }

    try {
      await this.sendCaptchaAndWait(phone)
    } catch (error) {
      await this.reply(`塔吉多登录失败：${getErrorMessage(error)}`)
    }

    return true
  }

  async consumeCaptcha () {
    if (this.e.isGroup) {
      return false
    }

    const pendingLogin = this.getPendingLogin()
    if (!pendingLogin) {
      return false
    }

    const captcha = String(this.e.msg || '').trim()
    if (!isValidCaptcha(captcha)) {
      return false
    }

    await this.loginWithCaptcha(pendingLogin.phone, captcha, pendingLogin.deviceId)
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
    } catch (error) {
      await this.reply(`塔吉多登录失败：${getErrorMessage(error)}`)
    }

    return true
  }

  async showSession () {
    try {
      const session = await this.getCurrentSession()

      if (!session?.fwt) {
        await this.reply(NO_SESSION_REPLY)
        return true
      }

      await this.reply(buildSessionSummary('当前塔吉多账号', session))
    } catch (error) {
      await this.reply(`查询账号失败：${getErrorMessage(error)}`)
    }

    return true
  }

  async refreshSession () {
    try {
      const currentSession = await this.requireCurrentSession()
      const data = await this.api.refreshSession({ fwt: currentSession.fwt })
      const { selfId, userId } = this.getSessionIdentity()
      const nextSession = await saveUserSession(selfId, userId, {
        username: currentSession.username,
        tgdUid: data?.tgdUid || currentSession.tgdUid,
        fwt: data?.fwt || currentSession.fwt
      })

      await this.reply(buildSessionSummary('塔吉多登录刷新完成', nextSession, [
        `结果：${data?.success === false ? '失败' : '成功'} | ${data?.message || '刷新完成'}`
      ]))
    } catch (error) {
      if (isAuthExpiredError(error)) {
        return this.handleAuthExpired('塔吉多登录刷新失败', error)
      }

      await this.reply(`塔吉多登录刷新失败：${getErrorMessage(error)}`)
    }

    return true
  }

  async logout () {
    try {
      const currentSession = await this.getCurrentSession()
      if (!currentSession?.fwt) {
        await this.reply('当前没有需要退出的登录账号')
        return true
      }

      await this.clearCurrentUserSession()
      await this.reply('当前塔吉多登录已退出')
    } catch (error) {
      await this.reply(`退出登录失败：${getErrorMessage(error)}`)
    }

    return true
  }

  async deleteAccount () {
    try {
      const currentSession = await this.requireCurrentSession('当前没有可删除的登录账号')
      const data = await this.api.deleteAccount(currentSession.fwt)
      await this.clearCurrentUserSession()

      await this.reply(joinLines([
        '塔吉多账号已删除',
        `结果：${data?.message || '删除成功'}`
      ]))
    } catch (error) {
      if (isAuthExpiredError(error)) {
        return this.handleAuthExpired('删除账号失败', error)
      }

      await this.reply(`删除账号失败：${getErrorMessage(error)}`)
    }

    return true
  }
}
