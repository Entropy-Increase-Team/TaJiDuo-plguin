import { PREFIX } from '../../utils/common.js'
import { resolveYihuanAlias } from '../../utils/yihuanAlias.js'
import {
  YihuanBase,
  cleanGameText,
  cleanSpaces,
  compactLine,
  dataBody,
  enumLabel,
  filterByQuery,
  getMessage,
  normalizeText,
  safeSection,
  summarizeApiError,
  toArray,
  trimMsg
} from './shared/core.js'

function formatPanelValue(value = '') {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/%|[A-Za-z一-龥]/.test(raw)) return raw
  const num = Number(raw)
  return Number.isFinite(num) ? String(Math.round(num)) : raw
}

function propertyLabel(item = {}) {
  const label = item.name || item.id || item.key || item.type
  const value = item.value ?? item.val ?? item.num ?? item.total
  if (!label && value === undefined) return ''
  return value === undefined || value === '' ? String(label) : `${label} ${formatPanelValue(value)}`
}

function formatPropertyLines(items = [], limit = 30) {
  const properties = toArray(items).slice(0, limit).map(propertyLabel).filter(Boolean)
  const lines = []
  for (let i = 0; i < properties.length; i += 2) {
    lines.push(properties.slice(i, i + 2).join(' | '))
  }
  return lines
}

function skillSummaryLabel(skill = {}) {
  const name = skill.name || skill.id || '未命名'
  return skill.level !== undefined ? `${name} Lv.${skill.level}` : String(name)
}

function formatSkillSummaryLines(items = [], title = '技能') {
  const skills = toArray(items).map(skillSummaryLabel).filter(Boolean)
  if (skills.length === 0) return []
  const lines = [`${title}：`]
  for (let i = 0; i < skills.length; i += 3) {
    lines.push(skills.slice(i, i + 3).join(' | '))
  }
  return lines
}

function formatEquipmentPiece(item = {}, index = 0) {
  const lines = [
    `${index ? `${index}. ` : ''}${item.name || item.id || '驱动'}${item.lev !== undefined ? ` Lv.${item.lev}` : ''}`
  ]
  const main = formatPropertyLines(item.mainProperties, 8)
  if (main.length) lines.push(`主属性：${main.join(' | ')}`)
  const sub = formatPropertyLines(item.properties, 8)
  if (sub.length) lines.push(`副属性：${sub.join(' | ')}`)
  return lines.join('\n')
}

function fillTemplate(text = '', values = []) {
  let out = String(text || '')
  toArray(values).forEach((value, index) => {
    out = out.replace(new RegExp(`\\{${index}\\}`, 'g'), String(value))
  })
  return cleanGameText(out)
}

function buildYihuanPanelMessages(character = {}) {
  const messages = []
  const baseLines = [
    `异环${character.name || character.id || '角色'}面板`,
    compactLine('等级', character.alev),
    compactLine('属性', enumLabel(character.elementType)),
    compactLine('阶段', character.slev),
    compactLine('觉醒', character.awakenLev),
    compactLine('好感', character.likeabilitylev)
  ]
  if (toArray(character.awakenEffect).length) {
    baseLines.push(compactLine('觉醒效果', toArray(character.awakenEffect).join(' / ')))
  }
  messages.push(baseLines.join('\n'))

  const propertyLines = formatPropertyLines(character.properties)
  if (propertyLines.length) messages.push(safeSection('面板属性', propertyLines))

  const skillLines = [
    ...formatSkillSummaryLines(character.skills, '战斗技能'),
    ...formatSkillSummaryLines(character.citySkills, '城市技能')
  ]
  if (skillLines.length) messages.push(skillLines.join('\n'))

  const fork = character.fork || {}
  if (Object.keys(fork).length > 0) {
    const forkLines = [
      `弧盘 / 武器：${fork.name || fork.id || '未装备'}`,
      compactLine('品质', enumLabel(fork.quality)),
      compactLine('等级', fork.alev),
      compactLine('突破', fork.blev),
      compactLine('星级', fork.slev),
      compactLine('效果', fork.buffName),
      fillTemplate(fork.buffDes, fork.lbd)
    ]
    const forkProperties = formatPropertyLines(fork.properties)
    if (forkProperties.length) forkLines.push('属性：', ...forkProperties)
    messages.push(forkLines.filter((line) => line !== '').join('\n'))
  }

  const suit = character.suit || {}
  if (Object.keys(suit).length > 0) {
    const suitLines = [
      `驱动套装：${suit.name || suit.id || '未装备'}`,
      compactLine('激活件数', suit.suitActivateNum),
      cleanGameText(suit.des2),
      cleanGameText(suit.des4)
    ]
    messages.push(suitLines.filter((line) => line !== '').join('\n'))

    toArray(suit.core).forEach((item, index) => {
      messages.push(safeSection(`核心驱动 ${index + 1}`, [formatEquipmentPiece(item)]))
    })

    const pie = toArray(suit.pie)
    if (pie.length) {
      for (let i = 0; i < pie.length; i += 3) {
        messages.push(safeSection('驱动件', pie.slice(i, i + 3).map((item, offset) => formatEquipmentPiece(item, i + offset + 1))))
      }
    }
  }

  return messages.filter((message) => cleanSpaces(message))
}

function getYihuanPanelQuery(text = '') {
  return cleanSpaces(String(text || '').trim()
    .replace(new RegExp(`^${PREFIX.yihuan}\\s*`, 'i'), '')
    .replace(/\s*(?:面板|信息|详情|面包|🍞)$/, ''))
}

function pickBestCharacter(items = [], query = '') {
  const terms = cleanSpaces(query).split(/[,\s，、]+/).filter(Boolean).map(normalizeText)
  if (terms.length === 0) return items[0] || null
  return items.find((item) => terms.some((term) => normalizeText(item.name) === term || normalizeText(item.id) === term))
    || items.find((item) => terms.some((term) => normalizeText(item.name).includes(term)))
    || items[0]
    || null
}

export class yihuanCharacterPanel extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环角色面板',
      dsc: '异环角色面板查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(?!(?:更新|刷新)面[板版]$)(?!面板[更新刷新]+$)(?!强制刷新$)\\s*.+?\\s*(?:面板|信息|详情)$',
          fnc: 'yihuanCharacterPanel'
        }
      ]
    })
  }

  async yihuanCharacterPanel() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const panelQuery = await resolveYihuanAlias(getYihuanPanelQuery(trimMsg(this.e)))
    if (!panelQuery) {
      await this.reply('请写角色名，例如：yh早雾面板')
      return true
    }

    const resolved = await this.resolveGameRole(tjdUser, 'yihuan', panelQuery)
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_characters', { roleId: role.roleId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const characterQuery = resolved.query || panelQuery
    const items = filterByQuery(toArray(dataBody(res)), characterQuery)
    const character = pickBestCharacter(items, characterQuery)
    if (!character) {
      await this.reply(`没有找到角色面板：${characterQuery}`)
      return true
    }

    const messages = buildYihuanPanelMessages(character)
    if (items.length > 1) {
      messages[0] += `\n匹配到 ${items.length} 个结果，已展示：${character.name || character.id}`
    }
    await this.replyForward(messages, `异环${character.name || character.id}面板`)
    return true
  }
}
