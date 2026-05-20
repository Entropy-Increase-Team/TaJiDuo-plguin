import TaJiDuoUser from '../../../model/tajiduoUser.js'
import {
  compactLine,
  formatTime,
  getMessage,
  getUnbindMessage,
  normalizeRole,
  pickRole,
  summarizeApiError,
  trimMsg
} from '../../../utils/common.js'

export {
  compactLine,
  formatTime,
  getMessage,
  summarizeApiError,
  trimMsg
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRoleId(text = '') {
  return String(text).match(/\d{5,}/)?.[0] || ''
}

function escapeRegExp(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeText(text = '') {
  return String(text || '').toLowerCase().replace(/\s+/g, '')
}

export function cleanSpaces(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

export function getCommandArgs(text = '', gameCode = 'yihuan', commandPattern = '') {
  const prefix = gameCode === 'huanta' ? '(?:幻塔|[Hh][Tt])' : '(?:异环|[Yy][Hh])'
  return cleanSpaces(String(text || '').trim().replace(new RegExp(`^[/#]?${prefix}\\s*${commandPattern}`, 'i'), ''))
}

function removeFirstText(text = '', value = '') {
  if (!value) return cleanSpaces(text)
  return cleanSpaces(String(text || '').replace(new RegExp(escapeRegExp(String(value)), 'i'), ' '))
}

export function searchTerms(query = '') {
  return cleanSpaces(query).split(/[,\s，、]+/).filter(Boolean)
}

export function toArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.list)) return value.list
  if (Array.isArray(value?.detail)) return value.detail
  return []
}

export function dataBody(res = {}) {
  return res.data?.data ?? res.data ?? {}
}

export function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key)
}

export function isOwned(item = {}) {
  return [item.own, item.owned, item.unlock, item.has].some((value) => value === true || value === 1 || value === '1' || value === 'true')
}

export function countOwned(items = []) {
  return items.filter((item) => isOwned(item)).length
}

export function percentLabel(progress = 0, total = 0) {
  const current = Number(progress ?? 0)
  const target = Number(total ?? 0)
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return '0%'
  const value = (current / target) * 100
  return `${value.toFixed(2).replace(/\.?0+$/, '')}%`
}

export function itemName(item = {}) {
  return item.name || item.showName || item.title || item.id || item.ID || '未命名'
}

function collectStrings(value, depth = 0) {
  if (depth > 3 || value === undefined || value === null) return []
  if (typeof value === 'string' || typeof value === 'number') return [String(value)]
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1))
  if (typeof value === 'object') return Object.values(value).flatMap((item) => collectStrings(item, depth + 1))
  return []
}

function itemMatches(item = {}, term = '') {
  const needle = normalizeText(term)
  if (!needle) return true
  const fields = new Set([
    itemName(item),
    item.id,
    item.ID,
    item.desc,
    item.description,
    item.quality,
    item.elementType,
    item.groupType,
    item.showName,
    item.showId,
    ...collectStrings(item)
  ])
  return [...fields].some((value) => normalizeText(value).includes(needle))
}

export function filterByQuery(items = [], query = '') {
  const terms = searchTerms(query)
  if (terms.length === 0) return items
  return items.filter((item) => terms.some((term) => itemMatches(item, term)))
}

export function pickBestItem(items = [], query = '') {
  const terms = searchTerms(query).map(normalizeText).filter(Boolean)
  if (terms.length === 0) return items[0] || null
  return items.find((item) => terms.some((term) => normalizeText(itemName(item)) === term || normalizeText(item.id) === term || normalizeText(item.ID) === term))
    || items.find((item) => terms.some((term) => normalizeText(itemName(item)).includes(term)))
    || items[0]
    || null
}

export function queryLabel(query = '') {
  const text = cleanSpaces(query)
  return text ? ` / ${text}` : ''
}

export function enumLabel(value = '') {
  const map = {
    ITEM_QUALITY_ORANGE: '橙',
    ITEM_QUALITY_PURPLE: '紫',
    CHARACTER_ELEMENT_TYPE_COSMOS: '光',
    CHARACTER_ELEMENT_TYPE_NATURE: '灵',
    CHARACTER_ELEMENT_TYPE_INCANTATION: '咒',
    CHARACTER_ELEMENT_TYPE_PSYCHE: '魂',
    CHARACTER_ELEMENT_TYPE_LAKSHANA: '相',
    CHARACTER_GROUP_TYPE_ONE: '分组1',
    CHARACTER_GROUP_TYPE_TWO: '分组2',
    CHARACTER_GROUP_TYPE_THREE: '分组3',
    CHARACTER_GROUP_TYPE_FOUR: '分组4',
    CHARACTER_GROUP_TYPE_FIVE: '分组5'
  }
  return map[value] || value || ''
}

export function cleanGameText(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/<\/>/g, '')
    .replace(/\\r\\n|\\n|\\r/g, '')
    .replace(/\/n|\/r/g, '')
    .replace(/\r\n|\n|\r/g, '')
    .replace(/([。！？；，、：）)”》])r?n(?=[\u4e00-\u9fa5A-Za-z0-9「“"《（])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function safeSection(title, lines = []) {
  return [title, ...lines.filter((line) => line !== undefined && line !== null && String(line).trim() !== '')].join('\n')
}

export class YihuanBase extends plugin {
  async getCurrentUser() {
    const userId = this.e.at || this.e.user_id
    const tjdUser = new TaJiDuoUser(userId)
    if (!await tjdUser.getUser()) {
      await this.reply(getUnbindMessage())
      return null
    }
    return tjdUser
  }

  async resolveGameRole(tjdUser, gameCode, args = '') {
    const rolesRes = await tjdUser.tjdReq.getData('game_roles', { gameCode })
    const roles = (rolesRes?.data?.roles || []).map(normalizeRole).filter((role) => role.roleId)
    let query = cleanSpaces(args)
    const roleId = getRoleId(query)
    let role = null

    if (roleId) {
      role = pickRole(roles, roleId)
      query = removeFirstText(query, roleId)
    }

    if (!role && query) {
      const queryText = normalizeText(query)
      const matched = [...roles]
        .filter((item) => item.roleName)
        .sort((a, b) => normalizeText(b.roleName).length - normalizeText(a.roleName).length)
        .find((item) => queryText.includes(normalizeText(item.roleName)))
      if (matched) {
        role = matched
        query = removeFirstText(query, matched.roleName)
      }
    }

    return {
      role: role || roles[0] || null,
      roles,
      query
    }
  }

  async replyForward(messages = [], title = 'TaJiDuo 面板') {
    const textMessages = messages.map((message) => String(message || '').trim()).filter(Boolean)
    if (textMessages.length === 0) return this.reply(getMessage('common.no_data'))

    const bot = global.Bot
    const userId = String(this.e?.user_id || bot?.uin || '80000000')
    const nickname = this.e?.sender?.card || this.e?.sender?.nickname || 'TaJiDuo'
    const nodes = textMessages.map((message, index) => ({
      user_id: userId,
      nickname: index === 0 ? title : nickname,
      message
    }))

    try {
      let forward = null
      if (bot?.makeForwardMsg) {
        forward = await bot.makeForwardMsg(nodes)
      } else if (this.e?.group?.makeForwardMsg) {
        forward = await this.e.group.makeForwardMsg(nodes)
      } else if (this.e?.friend?.makeForwardMsg) {
        forward = await this.e.friend.makeForwardMsg(nodes)
      }
      if (forward) {
        await this.reply(forward)
        return true
      }
    } catch (error) {
      logger.error(`[TaJiDuo-plugin][合并转发]发送失败：${error?.message || error}`)
    }

    await this.reply(textMessages.join('\n\n-----\n\n'))
    return true
  }
}
