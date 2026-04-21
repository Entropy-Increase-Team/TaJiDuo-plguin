const USER_SESSION_KEY_PREFIX = 'TAJIDUO:SESSION:'
const USER_SESSION_INDEX_REDIS_KEY = `${USER_SESSION_KEY_PREFIX}INDEX`
const USER_SESSION_REDIS_KEY = (selfId, userId) => `${USER_SESSION_KEY_PREFIX}${String(selfId || 'bot').trim()}:${String(userId || '').trim()}`

const normalizeSessionIdentity = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return null
  const selfId = String(payload.selfId || '').trim()
  const userId = String(payload.userId || '').trim()
  return selfId && userId ? { selfId, userId } : null
}

const encodeSessionIdentity = (payload = {}) => {
  const normalized = normalizeSessionIdentity(payload)
  return normalized ? JSON.stringify(normalized) : ''
}

const decodeSessionIdentity = (value = '') => {
  const text = String(value || '').trim()
  if (!text) return null
  
  try {
    return normalizeSessionIdentity(JSON.parse(text))
  } catch {
    const idx = text.indexOf(':')
    if (idx <= 0 || idx >= text.length - 1) return null
    return normalizeSessionIdentity({ selfId: text.slice(0, idx), userId: text.slice(idx + 1) })
  }
}

const parseSessionKey = (key = '') => {
  const text = String(key || '').trim()
  if (!text.startsWith(USER_SESSION_KEY_PREFIX)) return null
  
  const suffix = text.slice(USER_SESSION_KEY_PREFIX.length)
  if (!suffix || suffix === 'INDEX') return null
  
  const idx = suffix.indexOf(':')
  if (idx <= 0 || idx >= suffix.length - 1) return null
  
  return normalizeSessionIdentity({ selfId: suffix.slice(0, idx), userId: suffix.slice(idx + 1) })
}

const uniqueSessionIdentities = (items = []) => {
  const map = new Map()
  for (const item of items) {
    const normalized = normalizeSessionIdentity(item)
    if (normalized) map.set(`${normalized.selfId}:${normalized.userId}`, normalized)
  }
  return [...map.values()]
}

const getSessionRedisKey = (selfId, userId) => {
  const key = USER_SESSION_REDIS_KEY(selfId, userId)
  if (key.endsWith(':')) throw new Error('缺少用户 ID，无法读取 TaJiDuo 会话')
  return key
}

const normalizeSession = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return null
  const username = String(payload.username || '').trim()
  const tgdUid = String(payload.tjdUid || payload.tgdUid || '').trim()
  const fwt = String(payload.fwt || '').trim()
  return fwt ? { username, tgdUid, fwt } : null
}

const _hasRedisMethod = (method) => typeof redis[method] === 'function'

const getUserSession = async (selfId, userId) => {
  const text = await redis.get(getSessionRedisKey(selfId, userId))
  if (!text) return null
  try {
    return normalizeSession(JSON.parse(text))
  } catch (error) {
    logger.error('[TaJiDuo-plugin] 解析会话缓存失败', error)
    return null
  }
}

const saveUserSession = async (selfId, userId, payload = {}) => {
  const key = getSessionRedisKey(selfId, userId)
  const current = await getUserSession(selfId, userId)
  const next = normalizeSession({ ...current, ...payload })
  
  if (!next) throw new Error('会话数据不完整，无法保存')
  
  await redis.set(key, JSON.stringify(next))
  if (_hasRedisMethod('sadd')) {
    await redis.sadd(USER_SESSION_INDEX_REDIS_KEY, encodeSessionIdentity({ selfId, userId }))
  }
  return next
}

const clearUserSession = async (selfId, userId) => {
  const key = getSessionRedisKey(selfId, userId)
  const deleted = await redis.del(key)
  if (_hasRedisMethod('srem')) {
    await redis.srem(USER_SESSION_INDEX_REDIS_KEY, encodeSessionIdentity({ selfId, userId }))
  }
  return deleted
}

const listSessionIdentities = async () => {
  if (_hasRedisMethod('smembers')) {
    const indexed = uniqueSessionIdentities(
      (await redis.smembers(USER_SESSION_INDEX_REDIS_KEY)).map(decodeSessionIdentity)
    )
    if (indexed.length) return indexed
  }
  
  if (!_hasRedisMethod('keys')) return []
  
  const scanned = uniqueSessionIdentities(
    (await redis.keys(`${USER_SESSION_KEY_PREFIX}*`)).map(parseSessionKey)
  )
  
  if (scanned.length && _hasRedisMethod('sadd')) {
    for (const identity of scanned) {
      await redis.sadd(USER_SESSION_INDEX_REDIS_KEY, encodeSessionIdentity(identity))
    }
  }
  return scanned
}

const listUserSessions = async () => {
  const identities = await listSessionIdentities()
  const items = []
  
  for (const identity of identities) {
    const session = await getUserSession(identity.selfId, identity.userId)
    if (session?.fwt) {
      items.push({ ...identity, session })
    } else if (_hasRedisMethod('srem')) {
      await redis.srem(USER_SESSION_INDEX_REDIS_KEY, encodeSessionIdentity(identity))
    }
  }
  return items
}

export {
  clearUserSession,
  getSessionRedisKey,
  getUserSession,
  listSessionIdentities,
  listUserSessions,
  normalizeSession,
  normalizeSessionIdentity,
  saveUserSession
}
