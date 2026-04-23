import axios from 'axios'
import Config from '../utils/config.js'

const DEFAULT_REQUEST_TIMEOUT_MS = 15000
const DEFAULT_COMMUNITY_TASK_TIMEOUT_MS = 300000

function trimSlash (value) {
  return String(value || '').replace(/\/+$/, '')
}

function ensureHttpScheme (value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  return `https://${text}`
}

function isPlainObject (value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function createRequestError (message, extra = {}) {
  const error = new Error(message)
  Object.assign(error, extra)
  return error
}

function isAuthErrorStatus (status) {
  return Number(status) === 401
}

function isAuthErrorCode (code) {
  return Number(code) === 401
}

function getErrorMessage (error) {
  if (error?.response?.data?.message) return String(error.response.data.message)
  if (error?.response?.statusText) return String(error.response.statusText)
  if (error?.message) return String(error.message)
  return '未知错误'
}

function omitEmptyValues (payload = {}) {
  if (!isPlainObject(payload)) return payload

  const result = {}
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    result[key] = value
  }
  return result
}

function normalizePositiveTimeout (value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.round(num)
}

function normalizePositiveDelay (value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.round(num)
}

function normalizeNonNegativeDelay (value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.round(num)
}

function buildFrameworkHeaders (fwt = '') {
  const token = String(fwt || '').trim()
  if (!token) return {}

  return {
    'X-Framework-Token': token
  }
}

function buildPlatformHeaders (platformId = '', platformUserId = '') {
  const nextPlatformId = String(platformId || '').trim()
  const nextPlatformUserId = String(platformUserId || '').trim()
  const headers = {}

  if (nextPlatformId) {
    headers['X-Platform-Id'] = nextPlatformId
  }

  if (nextPlatformUserId) {
    headers['X-Platform-User-Id'] = nextPlatformUserId
  }

  return headers
}

function buildApiKeyHeaders (apiKey = '') {
  const token = String(apiKey || '').trim()
  if (!token) return {}

  return {
    'X-API-Key': token
  }
}

function buildConsoleKeyHeaders (consoleKey = '') {
  const token = String(consoleKey || '').trim()
  if (!token) return {}

  return {
    'X-Console-Key': token
  }
}

function getFrameworkToken (payload = {}) {
  if (isPlainObject(payload)) {
    return String(payload?.fwt || '').trim()
  }

  return String(payload || '').trim()
}

function omitFrameworkToken (payload = {}) {
  if (!isPlainObject(payload)) return payload

  const { fwt: _fwt, ...rest } = payload
  return omitEmptyValues(rest)
}

function buildQuery (extra = {}) {
  return omitEmptyValues(isPlainObject(extra) ? { ...extra } : {})
}

export { createRequestError }

export default class TaJiDuoApi {
  constructor () {
    this.client = axios.create({
      timeout: this.getDefaultTimeoutMs(),
      validateStatus: () => true
    })
  }

  getDefaultTimeoutMs () {
    return normalizePositiveTimeout(
      Config.get('tajiduo', 'request_timeout_ms'),
      DEFAULT_REQUEST_TIMEOUT_MS
    )
  }

  getCommunityTaskTimeoutMs () {
    return normalizePositiveTimeout(
      Config.get('tajiduo', 'community_task_timeout_ms'),
      DEFAULT_COMMUNITY_TASK_TIMEOUT_MS
    )
  }

  estimateSingleCommunityTimeoutMs (payload = {}) {
    const actionDelayMs = normalizeNonNegativeDelay(payload?.actionDelayMs, 3000)
    const stepDelayMs = normalizeNonNegativeDelay(payload?.stepDelayMs, 8000)

    // 预留接口本身耗时 + 多次动作等待 + 步骤间等待
    return 60000 + (actionDelayMs * 10) + (stepDelayMs * 5)
  }

  estimateAllCommunitiesTimeoutMs (payload = {}) {
    const betweenCommunitiesMs = normalizeNonNegativeDelay(payload?.betweenCommunitiesMs, 15000)
    return (this.estimateSingleCommunityTimeoutMs(payload) * 2) + betweenCommunitiesMs + 30000
  }

  getBaseUrl () {
    const baseUrl = trimSlash(ensureHttpScheme(Config.get('tajiduo', 'base_url')))
    if (!baseUrl) {
      throw createRequestError('请先在 TaJiDuo 插件配置中填写后端 base_url')
    }
    return baseUrl
  }

  getApiKey () {
    const candidates = [
      Config.get('tajiduo', 'api_key'),
      Config.get('tajiduo', 'apikey'),
      Config.get('tajiduo', 'apiKey')
    ]

    for (const value of candidates) {
      const token = String(value || '').trim()
      if (token) {
        return token
      }
    }

    throw createRequestError('请先在 TaJiDuo 插件配置中填写 api_key')
  }

  async request (urlPath, options = {}) {
    const {
      method = 'get',
      params,
      data,
      headers = {},
      timeoutMs,
      withApiKey = true
    } = options

    let response
    try {
      response = await this.client.request({
        url: `${this.getBaseUrl()}${urlPath}`,
        method,
        params: isPlainObject(params) ? omitEmptyValues(params) : params,
        data: isPlainObject(data) ? omitEmptyValues(data) : data,
        headers: {
          ...(withApiKey ? buildApiKeyHeaders(this.getApiKey()) : {}),
          ...headers
        },
        timeout: normalizePositiveTimeout(timeoutMs, this.getDefaultTimeoutMs())
      })
    } catch (error) {
      throw createRequestError(getErrorMessage(error), {
        originalError: error
      })
    }

    const body = response.data

    if (response.status >= 400) {
      const message = isPlainObject(body) ? body.message : `请求失败：HTTP ${response.status}`
      throw createRequestError(message || `请求失败：HTTP ${response.status}`, {
        responseStatus: response.status,
        responseCode: isPlainObject(body) ? Number(body.code) : undefined,
        isAuthError: isAuthErrorStatus(response.status) || isAuthErrorCode(body?.code),
        responseBody: body
      })
    }

    if (!isPlainObject(body)) {
      return body
    }

    if (body.code !== undefined) {
      if (Number(body.code) !== 0) {
        throw createRequestError(body.message || `请求失败：业务码 ${body.code}`, {
          responseStatus: response.status,
          responseCode: Number(body.code),
          isAuthError: isAuthErrorStatus(response.status) || isAuthErrorCode(body.code),
          responseBody: body
        })
      }

      return body.data ?? {}
    }

    return body
  }

  sendCaptcha (payload = {}) {
    return this.request('/api/v1/login/tajiduo/captcha/send', {
      method: 'post',
      data: payload
    })
  }

  checkCaptcha (payload = {}) {
    return this.request('/api/v1/login/tajiduo/captcha/check', {
      method: 'post',
      data: payload
    })
  }

  createSession (payload = {}, options = {}) {
    const platformId = String(options?.platformId || '').trim()
    const platformUserId = String(options?.platformUserId || '').trim()

    return this.request('/api/v1/login/tajiduo/session', {
      method: 'post',
      data: payload,
      headers: buildPlatformHeaders(platformId, platformUserId)
    })
  }

  refreshSession (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/login/tajiduo/refresh', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  listAccounts (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/login/tajiduo/accounts', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  setPrimaryAccount (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/login/tajiduo/accounts/primary', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  deleteAccount (fwt = '') {
    const token = String(fwt || '').trim()
    if (!token) {
      throw createRequestError('缺少 fwt，无法删除账号')
    }

    return this.request(`/api/v1/login/tajiduo/accounts/${encodeURIComponent(token)}`, {
      method: 'delete',
      headers: buildFrameworkHeaders(token)
    })
  }

  health () {
    return this.request('/health', {
      method: 'get',
      withApiKey: false
    })
  }

  healthDetailed () {
    return this.request('/health/detailed', {
      method: 'get',
      withApiKey: false
    })
  }

  apiKeygenHealth () {
    return this.request('/_internal/api-keygen/health', {
      method: 'get',
      withApiKey: false
    })
  }

  generateApiKey (payload = {}, options = {}) {
    const consoleKey = String(options?.consoleKey || payload?.consoleKey || '').trim()
    const { consoleKey: _consoleKey, ...data } = payload || {}

    return this.request('/_internal/api-keygen/generate', {
      method: 'post',
      data,
      headers: buildConsoleKeyHeaders(consoleKey),
      withApiKey: false
    })
  }

  grantAdminApiKey (payload = {}, options = {}) {
    const consoleKey = String(options?.consoleKey || payload?.consoleKey || '').trim()
    const { consoleKey: _consoleKey, ...data } = payload || {}

    return this.request('/_internal/api-keygen/grant-admin', {
      method: 'post',
      data,
      headers: buildConsoleKeyHeaders(consoleKey),
      withApiKey: false
    })
  }

  listGames (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  listRedeemCodes (payload = {}) {
    const query = omitEmptyValues({
      gameCode: payload?.gameCode,
      includeExpired: payload?.includeExpired
    })

    return this.request('/api/v1/games/redeem-codes', {
      method: 'get',
      params: query
    })
  }

  createRedeemCode (payload = {}) {
    return this.request('/api/v1/games/redeem-codes', {
      method: 'post',
      data: payload
    })
  }

  listShopGoods (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/shop/goods', {
      method: 'get',
      params: buildQuery({
        version: payload?.version,
        count: payload?.count,
        tab: payload?.tab
      }),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  getShopGoodsDetail (goodsId = '', payload = {}) {
    const nextGoodsId = String(goodsId || payload?.goodsId || '').trim()
    const fwt = getFrameworkToken(payload)

    if (!nextGoodsId) {
      throw createRequestError('缺少 goodsId，无法查询商品详情')
    }

    return this.request(`/api/v1/games/shop/goods/${encodeURIComponent(nextGoodsId)}`, {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  getShopCoinState (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/shop/coin/state', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  getShopGameRoles (payload = {}) {
    const fwt = getFrameworkToken(payload)
    const gameId = String(payload?.gameId || '').trim()

    if (!gameId) {
      throw createRequestError('缺少 gameId，无法查询商城角色列表')
    }

    return this.request('/api/v1/games/shop/game-roles', {
      method: 'get',
      params: buildQuery({ gameId }),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  shopExchange (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/shop/exchange', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  communitySignAll (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/community/sign/all', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt),
      timeoutMs: Math.max(
        this.getCommunityTaskTimeoutMs(),
        this.estimateAllCommunitiesTimeoutMs(payload)
      )
    })
  }

  communitySignTask (taskId = '', payload = {}) {
    const taskKey = String(taskId || '').trim()
    const fwt = getFrameworkToken(payload)

    if (!taskKey) {
      throw createRequestError('缺少 taskId，无法查询跨社区任务状态')
    }

    return this.request(`/api/v1/games/community/sign/tasks/${encodeURIComponent(taskKey)}`, {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaRoles (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/roles', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaSignGame (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/sign/game', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaSignAll (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/sign/all', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaSignApp (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/sign/app', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunitySignAll (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/community/sign/all', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt),
      timeoutMs: Math.max(
        this.getCommunityTaskTimeoutMs(),
        this.estimateSingleCommunityTimeoutMs(payload)
      )
    })
  }

  huantaCommunitySignTask (taskId = '', payload = {}) {
    const taskKey = String(taskId || '').trim()
    const fwt = getFrameworkToken(payload)

    if (!taskKey) {
      throw createRequestError('缺少 taskId，无法查询幻塔社区任务状态')
    }

    return this.request(`/api/v1/games/huanta/community/sign/tasks/${encodeURIComponent(taskKey)}`, {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunitySignState (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/community/sign/state', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunityExpLevel (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/community/exp/level', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunityExpRecords (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/huanta/community/exp/records', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunityTasks (payload = {}) {
    const fwt = getFrameworkToken(payload)
    const gid = normalizePositiveDelay(payload?.gid, 2)

    return this.request('/api/v1/games/huanta/community/tasks', {
      method: 'get',
      params: buildQuery({ gid }),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanRoles (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/roles', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanSignState (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/sign/state', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanSignGame (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/sign/game', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanSignApp (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/sign/app', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunitySignAll (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/community/sign/all', {
      method: 'post',
      data: omitFrameworkToken(payload),
      headers: buildFrameworkHeaders(fwt),
      timeoutMs: Math.max(
        this.getCommunityTaskTimeoutMs(),
        this.estimateSingleCommunityTimeoutMs(payload)
      )
    })
  }

  yihuanCommunitySignTask (taskId = '', payload = {}) {
    const taskKey = String(taskId || '').trim()
    const fwt = getFrameworkToken(payload)

    if (!taskKey) {
      throw createRequestError('缺少 taskId，无法查询异环社区任务状态')
    }

    return this.request(`/api/v1/games/yihuan/community/sign/tasks/${encodeURIComponent(taskKey)}`, {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunitySignState (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/community/sign/state', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunityExpLevel (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/community/exp/level', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunityExpRecords (payload = {}) {
    const fwt = getFrameworkToken(payload)

    return this.request('/api/v1/games/yihuan/community/exp/records', {
      method: 'get',
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunityTasks (payload = {}) {
    const fwt = getFrameworkToken(payload)
    const gid = normalizePositiveDelay(payload?.gid, 2)

    return this.request('/api/v1/games/yihuan/community/tasks', {
      method: 'get',
      params: buildQuery({ gid }),
      headers: buildFrameworkHeaders(fwt)
    })
  }
}
