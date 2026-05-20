import TaJiDuoUser from '../../model/tajiduoUser.js'
import {
  compactLine,
  getMessage,
  getUnbindMessage,
  normalizeRole,
  pickRole,
  PREFIX,
  summarizeApiError,
  trimMsg
} from '../../utils/common.js'

function getRoleId(text = '') {
  return String(text).match(/\d{5,}/)?.[0] || ''
}

function escapeRegExp(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeText(text = '') {
  return String(text || '').toLowerCase().replace(/\s+/g, '')
}

function cleanSpaces(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function getCommandArgs(text = '') {
  return cleanSpaces(String(text || '').trim()
    .replace(new RegExp(`^${PREFIX.huanta}\\s*(?:档案|角色数据|战绩详情)`, 'i'), ''))
}

function getHuantaRecordType(text = '') {
  const value = String(text || '')
  if (/武器|type\s*1|类型\s*1|(?:^|\s)1(?:\s|$)/i.test(value)) return '1'
  if (/拟态|type\s*2|类型\s*2|(?:^|\s)2(?:\s|$)/i.test(value)) return '2'
  if (/时装|type\s*3|类型\s*3|(?:^|\s)3(?:\s|$)/i.test(value)) return '3'
  if (/载具|type\s*4|类型\s*4|(?:^|\s)4(?:\s|$)/i.test(value)) return '4'
  return '0'
}

function stripHuantaTypeWords(text = '') {
  return cleanSpaces(String(text || '')
    .replace(/武器|拟态|时装|载具/gi, ' ')
    .replace(/type\s*[1-4]|类型\s*[1-4]/gi, ' ')
    .replace(/(?:^|\s)[1-4](?=\s|$)/g, ' '))
}

function removeFirstText(text = '', value = '') {
  if (!value) return cleanSpaces(text)
  return cleanSpaces(String(text || '').replace(new RegExp(escapeRegExp(String(value)), 'i'), ' '))
}

function toArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.list)) return value.list
  if (Array.isArray(value?.detail)) return value.detail
  return []
}

function itemName(item = {}) {
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
  return collectStrings(item).some((value) => normalizeText(value).includes(needle))
}

function searchTerms(query = '') {
  return cleanSpaces(query).split(/[,\s，、]+/).filter(Boolean)
}

function filterByQuery(items = [], query = '') {
  const terms = searchTerms(query)
  if (terms.length === 0) return items
  return items.filter((item) => terms.some((term) => itemMatches(item, term)))
}

function queryLabel(query = '') {
  const text = cleanSpaces(query)
  return text ? ` / ${text}` : ''
}

function getHuantaList(record = {}, type = '0') {
  const map = {
    1: record.weaponinfo || record.weaponInfo || [],
    2: record.imitationlist || record.imitationList || [],
    3: record.dressfashionlist || record.dressFashionList || [],
    4: record.mountlist || record.mountList || []
  }
  if (type !== '0') return toArray(map[type])
  return [
    ...toArray(map[1]),
    ...toArray(map[2]),
    ...toArray(map[3]),
    ...toArray(map[4])
  ]
}

function huantaTypeLabel(type = '0') {
  return {
    0: '总览',
    1: '武器',
    2: '拟态',
    3: '时装',
    4: '载具'
  }[type] || '总览'
}

export class huanta extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]幻塔档案',
      dsc: '幻塔角色档案查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.huanta}(档案|角色数据|战绩详情)(?:\\s*.*)?$`,
          fnc: 'huantaRoleRecord'
        }
      ]
    })
  }

  async getCurrentUser() {
    const userId = this.e.at || this.e.user_id
    const tjdUser = new TaJiDuoUser(userId)
    if (!await tjdUser.getUser()) {
      await this.reply(getUnbindMessage())
      return null
    }
    return tjdUser
  }

  async resolveGameRole(tjdUser, args = '') {
    const rolesRes = await tjdUser.tjdReq.getData('game_roles', { gameCode: 'huanta' })
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
      query
    }
  }

  async huantaRoleRecord() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const args = getCommandArgs(trimMsg(this.e))
    const type = getHuantaRecordType(args)
    const resolved = await this.resolveGameRole(tjdUser, stripHuantaTypeWords(args))
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '幻塔' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('huanta_role_record', { roleId: role.roleId, type })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = res.data || {}
    const record = data.record || data.data || {}
    const selected = data.selected || record.selected || ''
    const items = filterByQuery(getHuantaList(record, type), resolved.query)

    const lines = [
      `幻塔档案${huantaTypeLabel(type)}：${record.rolename || record.roleName || role.roleName || role.roleId}${queryLabel(resolved.query)}`,
      compactLine('等级', record.lev ?? role.level),
      compactLine('服务器', record.groupname || record.serverName || role.serverName),
      compactLine('战力', record.maxgs),
      compactLine('当前展示', selected || getMessage('common.empty'))
    ]
    if (type === '0') {
      lines.push(compactLine('武器', toArray(record.weaponinfo || record.weaponInfo).length))
      lines.push(compactLine('拟态', toArray(record.imitationlist || record.imitationList).length))
      lines.push(compactLine('时装', toArray(record.dressfashionlist || record.dressFashionList).length))
      lines.push(compactLine('载具', toArray(record.mountlist || record.mountList).length))
      if (resolved.query) {
        for (const item of items.slice(0, 10)) {
          lines.push(`- ${itemName(item)}${item.ID || item.id ? ` / ${item.ID || item.id}` : ''}`)
        }
        if (items.length === 0) lines.push(`未找到匹配：${resolved.query}`)
      }
    } else {
      for (const item of items.slice(0, 10)) {
        lines.push(`- ${itemName(item)}${item.ID || item.id ? ` / ${item.ID || item.id}` : ''}`)
      }
      if (items.length === 0) lines.push(resolved.query ? `未找到匹配：${resolved.query}` : getMessage('common.no_data'))
    }
    await this.reply(lines.join('\n'))
    return true
  }
}
