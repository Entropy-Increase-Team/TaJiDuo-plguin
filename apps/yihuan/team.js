import TaJiDuoRequest from '../../model/tajiduoReq.js'
import { resolveYihuanAlias } from '../../utils/yihuanAlias.js'
import {
  getMessage,
  PREFIX,
  summarizeApiError,
  trimMsg
} from '../../utils/common.js'

function cleanSpaces(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function normalizeText(text = '') {
  return String(text || '').toLowerCase().replace(/\s+/g, '')
}

function toArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.list)) return value.list
  if (Array.isArray(value?.data)) return value.data
  return []
}

function dataBody(res = {}) {
  return res.data?.data ?? res.data ?? {}
}

function cleanGameText(value = '') {
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

function teamSectionTitle(index = 0) {
  return ['角色卡片', '配队推荐', '异能加点', '弧盘推荐', '空幕推荐'][index] || `推荐图 ${index + 1}`
}

function getYihuanTeamQuery(text = '') {
  return cleanSpaces(String(text || '').trim()
    .replace(new RegExp(`^${PREFIX.yihuan}\\s*`, 'i'), '')
    .replace(/\s*(?:配队推荐|配队)$/, ''))
}

function collectStrings(value, depth = 0) {
  if (depth > 3 || value === undefined || value === null) return []
  if (typeof value === 'string' || typeof value === 'number') return [String(value)]
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1))
  if (typeof value === 'object') return Object.values(value).flatMap((item) => collectStrings(item, depth + 1))
  return []
}

function itemMatches(item = {}, query = '') {
  const needle = normalizeText(query)
  if (!needle) return true
  return collectStrings(item).some((value) => normalizeText(value).includes(needle))
}

export class team extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环配队',
      dsc: '异环配队推荐',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.yihuan}\\s*.+?\\s*(?:配队推荐|配队)$`,
          fnc: 'yihuanTeam'
        }
      ]
    })
  }

  async yihuanTeam() {
    const query = await resolveYihuanAlias(getYihuanTeamQuery(trimMsg(this.e)))
    if (!query) {
      await this.reply('请写角色名，例如：yh早雾配队')
      return true
    }

    const req = new TaJiDuoRequest('', { log: false })
    const res = await req.getData('yihuan_team_recommendations')
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const allItems = toArray(dataBody(res))
    const items = allItems.filter((item) => itemMatches(item, query))
    if (items.length === 0) {
      await this.reply(`没有找到配队推荐：${query}`)
      return true
    }

    const lines = [`异环配队：${query}`]
    for (const item of items.slice(0, 3)) {
      lines.push(`【${item.name || item.id || '角色'}】`)
      if (item.desc) lines.push(cleanGameText(item.desc))
      const imgs = toArray(item.imgs)
      if (imgs.length) lines.push(...imgs.map((url, index) => `${teamSectionTitle(index)}：${url}`))
    }
    await this.reply(lines.join('\n'))
    return true
  }
}
