import TaJiDuoRequest from '../../../model/tajiduoReq.js'
import Server from '../../../components/Server.js'
import {
  addOrUpdateAccount,
  CAPTCHA_KEY,
  getUserAccounts,
  removeAccount,
  saveUserAccounts,
  switchAccount
} from '../../../model/tajiduoUser.js'
import {
  getMessage,
  getPlatformId,
  getPlatformUserId,
  maskToken,
  summarizeApiError,
  trimMsg
} from '../../../utils/common.js'

function getPhone(text = '') {
  return String(text).match(/1\d{10}/)?.[0] || ''
}

function getCaptcha(text = '') {
  const withoutPhone = String(text).replace(/1\d{10}/g, '')
  return withoutPhone.match(/\b\d{4,8}\b/)?.[0] || ''
}

function displayName(account = {}) {
  return account.nickname || account.username || account.tjd_uid || account.tgd_uid || maskToken(account.framework_token)
}

function sameAccount(a = {}, b = {}) {
  const aPlatformId = String(a.platform_id || a.platformId || '')
  const bPlatformId = String(b.platform_id || b.platformId || '')
  const aPlatformUserId = String(a.platform_user_id || a.platformUserId || '')
  const bPlatformUserId = String(b.platform_user_id || b.platformUserId || '')
  const aTgdUid = String(a.tgd_uid || a.tgdUid || '')
  const bTgdUid = String(b.tgd_uid || b.tgdUid || '')
  if (aPlatformId && bPlatformId && aPlatformUserId && bPlatformUserId && aTgdUid && bTgdUid) {
    return aPlatformId === bPlatformId && aPlatformUserId === bPlatformUserId && aTgdUid === bTgdUid
  }
  if (aTgdUid && bTgdUid) return aTgdUid === bTgdUid
  return String(a.framework_token || a.fwt || '') === String(b.framework_token || b.fwt || '')
}

function createLocalAccount(data = {}, fallback = {}) {
  const matched = fallback.matched || {}
  return {
    ...matched,
    framework_token: data.fwt || data.framework_token || matched.framework_token,
    fwt: data.fwt || data.framework_token || matched.framework_token,
    username: data.username || matched.username,
    nickname: data.nickname || data.username || matched.nickname || matched.username,
    tjd_uid: data.tjdUid || data.tjd_uid || matched.tjd_uid,
    tgd_uid: data.tgdUid || data.tgd_uid || matched.tgd_uid,
    avatar: data.avatar || matched.avatar,
    introduce: data.introduce || matched.introduce,
    device_id: data.deviceId || data.device_id || matched.device_id || fallback.deviceId || '',
    platform_id: data.platformId || data.platform_id || matched.platform_id || fallback.platformId || '',
    platform_user_id: data.platformUserId || data.platform_user_id || matched.platform_user_id || fallback.platformUserId || '',
    is_primary: data.isPrimary === true || data.is_primary === true || fallback.isPrimary === true,
    bind_time: matched.bind_time || Date.now(),
    created_at: data.createdAt || data.created_at || matched.created_at,
    updated_at: data.updatedAt || data.updated_at || matched.updated_at,
    last_refresh_at: data.lastRefreshAt || data.last_refresh_at || matched.last_refresh_at,
    last_sync: Date.now()
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class BaseLogin extends plugin {
  async sendCaptcha() {
    const text = trimMsg(this.e)
    const phone = getPhone(text)
    if (!phone) {
      await this.reply(getMessage('login.captcha_usage'))
      return true
    }

    return this.sendCaptchaByPhone(phone)
  }

  async sendCaptchaByPhone(phone) {
    const req = new TaJiDuoRequest()
    const res = await req.getData('captcha_send', { phone })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const deviceId = res.data?.deviceId || ''
    await redis.set(CAPTCHA_KEY(this.e.user_id), JSON.stringify({ phone, deviceId, time: Date.now() }), { EX: 600 })
    await this.reply(getMessage('login.captcha_sent', { phone, deviceId }))
    return true
  }

  async login() {
    const text = trimMsg(this.e)
    const phoneFromMsg = getPhone(text)
    const captcha = getCaptcha(text)
    if (!captcha) {
      const cfg = Server.getConfig()
      if (!cfg.enabled) {
        if (!phoneFromMsg) {
          await this.reply(getMessage('login.web_disabled'))
          return true
        }
        return this.sendCaptchaByPhone(phoneFromMsg)
      }
      return this.webLogin()
    }

    let pending = {}
    try {
      const raw = await redis.get(CAPTCHA_KEY(this.e.user_id))
      pending = raw ? JSON.parse(raw) : {}
    } catch (error) {
      pending = {}
    }

    const phone = phoneFromMsg || pending.phone
    const deviceId = pending.deviceId || ''
    if (!phone) {
      await this.reply(getMessage('login.pending_missing'))
      return true
    }

    const req = new TaJiDuoRequest()
    const res = await req.getData('session', {
      phone,
      captcha,
      deviceId,
      e: this.e,
      platformId: getPlatformId(this.e),
      platformUserId: getPlatformUserId(this.e)
    })

    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = res.data || {}
    const account = createLocalAccount(data, {
      deviceId,
      platformId: getPlatformId(this.e),
      platformUserId: getPlatformUserId(this.e),
      isPrimary: true
    })
    await addOrUpdateAccount(this.e.user_id, account)
    await this.syncBackendAccounts(account)
    await redis.del(CAPTCHA_KEY(this.e.user_id))

    await this.reply(getMessage('login.login_success', {
      name: displayName(account),
      uid: account.tjd_uid || account.tgd_uid || '未知'
    }))
    return true
  }

  async webLogin() {
    const cfg = Server.getConfig()
    if (!cfg.enabled) {
      await this.reply(getMessage('login.web_disabled'))
      return true
    }

    const platformId = getPlatformId(this.e)
    const platformUserId = getPlatformUserId(this.e)
    const { id, url } = Server.createSession(this.e, platformId, platformUserId)

    await this.reply(getMessage('login.web_link', {
      url,
      userId: platformUserId
    }))

    const timeout = Date.now() + 10 * 60 * 1000
    while (Date.now() < timeout) {
      const session = Server.data[id]
      if (!session) return true
      if (session.account) {
        await addOrUpdateAccount(this.e.user_id, session.account)
        await this.syncBackendAccounts(session.account)
        Server.consume(id)
        await this.reply(getMessage('login.login_success', {
          name: displayName(session.account),
          uid: session.account.tjd_uid || session.account.tgd_uid || '未知'
        }))
        return true
      }
      await sleep(1000)
    }

    Server.consume(id)
    await this.reply(getMessage('login.web_timeout'), true)
    return true
  }

  async accountList() {
    const accounts = await this.getSyncedAccounts()
    if (accounts.length === 0) {
      await this.reply(getMessage('login.account_empty'))
      return true
    }

    const lines = [getMessage('login.account_title')]
    accounts.forEach((account, index) => {
      lines.push(getMessage('login.account_line', {
        index: index + 1,
        mark: account.is_primary ? '当前 ' : '',
        name: displayName(account),
        uid: account.tjd_uid || account.tgd_uid || '未知',
        token: maskToken(account.framework_token)
      }))
    })
    await this.reply(lines.join('\n'))
    return true
  }

  async switchAccount() {
    const index = trimMsg(this.e).match(/(\d+)$/)?.[1]
    const accounts = await getUserAccounts(this.e.user_id)
    const targetIndex = index ? Number(index) : (accounts.length > 1 ? 2 : 1)
    const account = accounts[targetIndex - 1]
    if (!account) {
      await this.reply(getMessage('login.account_missing', { index: index || targetIndex }))
      return true
    }

    const req = new TaJiDuoRequest(account.framework_token)
    const res = await req.getData('account_primary')
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }
    await switchAccount(this.e.user_id, targetIndex)
    await this.syncBackendAccounts(account)
    await this.reply(getMessage('login.account_switched', { index: targetIndex, name: displayName(account) }))
    return true
  }

  async deleteAccount() {
    const index = trimMsg(this.e).match(/(\d+)$/)?.[1]
    const accounts = await getUserAccounts(this.e.user_id)
    const account = accounts[Number(index) - 1]
    if (!account) {
      await this.reply(getMessage('login.account_missing', { index }))
      return true
    }

    const req = new TaJiDuoRequest(account.framework_token)
    const res = await req.getData('account_delete', { fwt: account.framework_token })
    const code = Number(res?.code)
    if (res && code !== 0 && code !== 401) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }
    const removed = await removeAccount(this.e.user_id, index)
    const nextAccounts = await getUserAccounts(this.e.user_id)
    if (nextAccounts.length > 0) await this.syncBackendAccounts(nextAccounts.find((item) => item.is_primary) || nextAccounts[0])
    await this.reply(getMessage('login.account_removed', { index, name: displayName(removed) }))
    return true
  }

  async refreshAccount() {
    const accounts = await getUserAccounts(this.e.user_id)
    const account = accounts.find((item) => item.is_primary) || accounts[0]
    if (!account) {
      await this.reply(getMessage('login.account_empty'))
      return true
    }

    const req = new TaJiDuoRequest(account.framework_token)
    const res = await req.getData('refresh')
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = res.data || {}
    const refreshed = createLocalAccount(data, { matched: account })
    const next = accounts.map((item) => item.framework_token === account.framework_token
      ? {
          ...item,
          ...refreshed,
          last_sync: Date.now()
        }
      : item)
    await saveUserAccounts(this.e.user_id, next)
    await this.syncBackendAccounts(refreshed)
    await this.reply(getMessage('login.refresh_ok', { name: displayName(account) }))
    return true
  }

  async getSyncedAccounts() {
    const accounts = await getUserAccounts(this.e.user_id)
    const primary = accounts.find((item) => item.is_primary) || accounts[0]
    if (!primary) return accounts
    return this.syncBackendAccounts(primary, { silent: true })
  }

  async syncBackendAccounts(seedAccount, { silent = false } = {}) {
    if (!seedAccount?.framework_token) return getUserAccounts(this.e.user_id)

    const current = await getUserAccounts(this.e.user_id)
    const req = new TaJiDuoRequest(seedAccount.framework_token, { log: !silent })
    const res = await req.getData('accounts')
    if (!res || Number(res.code) !== 0) {
      if (!silent) logger.warn(`[TaJiDuo-plugin][多账号]同步后端账号失败：${summarizeApiError(res)}`)
      return current
    }

    const data = res.data || {}
    const items = Array.isArray(data.items) ? data.items : []
    const primary = data.primary || {}
    if (items.length === 0) return current

    const next = items.map((item) => {
      const matched = current.find((account) => sameAccount(account, item)) || {}
      return createLocalAccount(item, {
        matched,
        platformId: item.platformId || data.platformId || seedAccount.platform_id,
        platformUserId: item.platformUserId || data.platformUserId || seedAccount.platform_user_id,
        isPrimary: sameAccount(item, primary) || String(item.fwt || '') === String(primary.fwt || '')
      })
    })

    return saveUserAccounts(this.e.user_id, next)
  }
}
