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

function buildFrameworkQuery (fwt = '', extra = {}) {
  const token = String(fwt || '').trim()
  const payload = isPlainObject(extra) ? { ...extra } : {}

  if (token) {
    payload.fwt = token
  }

  return omitEmptyValues(payload)
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

  async request (urlPath, options = {}) {
    const {
      method = 'get',
      params,
      data,
      headers = {},
      timeoutMs
    } = options

    let response
    try {
      response = await this.client.request({
        url: `${this.getBaseUrl()}${urlPath}`,
        method,
        params: isPlainObject(params) ? omitEmptyValues(params) : params,
        data: isPlainObject(data) ? omitEmptyValues(data) : data,
        headers,
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
    const fwt = String(payload?.fwt || '').trim()

    return this.request('/api/v1/login/tajiduo/refresh', {
      method: 'post',
      data: fwt ? { fwt } : {},
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

  communitySignAll (payload = {}) {
    return this.request('/api/v1/games/community/sign/all', {
      method: 'post',
      data: payload,
      timeoutMs: Math.max(
        this.getCommunityTaskTimeoutMs(),
        this.estimateAllCommunitiesTimeoutMs(payload)
      )
    })
  }

  communitySignTask (taskId = '', payload = {}) {
    const taskKey = String(taskId || '').trim()
    const fwt = String(payload?.fwt || '').trim()

    if (!taskKey) {
      throw createRequestError('缺少 taskId，无法查询跨社区任务状态')
    }

    return this.request(`/api/v1/games/community/sign/tasks/${encodeURIComponent(taskKey)}`, {
      method: 'get',
      params: buildFrameworkQuery(fwt),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunitySignAll (payload = {}) {
    return this.request('/api/v1/games/huanta/community/sign/all', {
      method: 'post',
      data: payload,
      timeoutMs: Math.max(
        this.getCommunityTaskTimeoutMs(),
        this.estimateSingleCommunityTimeoutMs(payload)
      )
    })
  }

  huantaCommunitySignTask (taskId = '', payload = {}) {
    const taskKey = String(taskId || '').trim()
    const fwt = String(payload?.fwt || '').trim()

    if (!taskKey) {
      throw createRequestError('缺少 taskId，无法查询幻塔社区任务状态')
    }

    return this.request(`/api/v1/games/huanta/community/sign/tasks/${encodeURIComponent(taskKey)}`, {
      method: 'get',
      params: buildFrameworkQuery(fwt),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunityExpLevel (payload = {}) {
    const fwt = String(payload?.fwt || '').trim()

    return this.request('/api/v1/games/huanta/community/exp/level', {
      method: 'get',
      params: buildFrameworkQuery(fwt),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  huantaCommunityTasks (payload = {}) {
    const fwt = String(payload?.fwt || '').trim()
    const gid = normalizePositiveDelay(payload?.gid, 2)

    return this.request('/api/v1/games/huanta/community/tasks', {
      method: 'get',
      params: buildFrameworkQuery(fwt, { gid }),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunitySignAll (payload = {}) {
    return this.request('/api/v1/games/yihuan/community/sign/all', {
      method: 'post',
      data: payload,
      timeoutMs: Math.max(
        this.getCommunityTaskTimeoutMs(),
        this.estimateSingleCommunityTimeoutMs(payload)
      )
    })
  }

  yihuanCommunitySignTask (taskId = '', payload = {}) {
    const taskKey = String(taskId || '').trim()
    const fwt = String(payload?.fwt || '').trim()

    if (!taskKey) {
      throw createRequestError('缺少 taskId，无法查询异环社区任务状态')
    }

    return this.request(`/api/v1/games/yihuan/community/sign/tasks/${encodeURIComponent(taskKey)}`, {
      method: 'get',
      params: buildFrameworkQuery(fwt),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunityExpLevel (payload = {}) {
    const fwt = String(payload?.fwt || '').trim()

    return this.request('/api/v1/games/yihuan/community/exp/level', {
      method: 'get',
      params: buildFrameworkQuery(fwt),
      headers: buildFrameworkHeaders(fwt)
    })
  }

  yihuanCommunityTasks (payload = {}) {
    const fwt = String(payload?.fwt || '').trim()
    const gid = normalizePositiveDelay(payload?.gid, 2)

    return this.request('/api/v1/games/yihuan/community/tasks', {
      method: 'get',
      params: buildFrameworkQuery(fwt, { gid }),
      headers: buildFrameworkHeaders(fwt)
    })
  }
}
