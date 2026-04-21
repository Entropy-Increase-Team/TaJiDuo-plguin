import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import TaJiDuoApi from '../model/api.js'
import { getErrorMessage } from '../utils/auth.js'
import { joinLines } from '../utils/common.js'
import { buildCommandReg } from '../utils/command.js'
import { formatUtc8DateTime, getRedeemGameName, normalizeRedeemGameCode } from '../utils/redeem.js'

const REDEEM_COMMAND_CONFIG = Object.freeze({
  all: {
    title: '塔吉多兑换码',
    forwardTitle: '塔吉多兑换码',
    gameCode: ''
  },
  huanta: {
    title: '塔吉多幻塔兑换码',
    forwardTitle: '塔吉多幻塔兑换码',
    gameCode: 'huanta'
  },
  yihuan: {
    title: '塔吉多异环兑换码',
    forwardTitle: '塔吉多异环兑换码',
    gameCode: 'yihuan'
  }
})

function isPlainObject (value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function getRedeemItems (data = {}) {
  const items = Array.isArray(data?.items) ? data.items : []
  return items.filter((item) => isPlainObject(item))
}

function groupRedeemItemsByGame (items = []) {
  const map = new Map()

  for (const item of items) {
    const gameCode = normalizeRedeemGameCode(item?.gameCode) || 'unknown'
    const list = map.get(gameCode) || []
    list.push(item)
    map.set(gameCode, list)
  }

  return map
}

function isExpiredRedeemCode (item = {}) {
  const expiresAt = String(item?.expiresAt || item?.endAt || item?.endsAt || '').trim()
  if (!expiresAt) {
    return false
  }

  const expiresAtMs = new Date(expiresAt).getTime()
  return Number.isFinite(expiresAtMs) ? expiresAtMs <= Date.now() : false
}

function buildRedeemSummaryMessage (title = '', items = []) {
  const groups = groupRedeemItemsByGame(items)
  const lines = [title]

  if (items.length === 0) {
    lines.push('当前暂无可用兑换码')
    return joinLines(lines)
  }

  lines.push(`数量：${items.length}`)
  lines.push(`状态：默认仅展示未过期兑换码`)

  if (groups.size > 1) {
    for (const [gameCode, gameItems] of groups.entries()) {
      lines.push(`${getRedeemGameName(gameCode)}：${gameItems.length}`)
    }
  } else {
    const activeCount = items.filter((item) => !isExpiredRedeemCode(item)).length
    lines.push(`有效数量：${activeCount}`)
  }

  return joinLines(lines)
}

function buildRedeemGroupMessage (title = '', items = []) {
  const lines = [title]

  if (items.length === 0) {
    lines.push('当前暂无可用兑换码')
    return joinLines(lines)
  }

  items.forEach((item, index) => {
    const details = [`${index + 1}. ${item.code || '未返回兑换码'}`]

    if (item?.description) {
      details.push(`描述：${item.description}`)
    }

    if (item?.exchangeRewards) {
      details.push(`奖励：${item.exchangeRewards}`)
    }

    if (item?.expiresAt || item?.endAt || item?.endsAt) {
      details.push(`结束时间：${formatUtc8DateTime(item?.expiresAt || item?.endAt || item?.endsAt)}`)
    }

    details.push(`状态：${isExpiredRedeemCode(item) ? '已过期' : '可用'}`)
    lines.push(...details)

    if (index < items.length - 1) {
      lines.push('===')
    }
  })

  return joinLines(lines)
}

function buildRedeemMessages (title = '', items = [], gameCode = '') {
  const messages = [buildRedeemSummaryMessage(title, items)]

  if (items.length === 0) {
    return messages
  }

  if (gameCode) {
    messages.push(buildRedeemGroupMessage(`${getRedeemGameName(gameCode)}兑换码`, items))
    return messages
  }

  for (const [currentGameCode, gameItems] of groupRedeemItemsByGame(items).entries()) {
    messages.push(buildRedeemGroupMessage(`${getRedeemGameName(currentGameCode)}兑换码`, gameItems))
  }

  return messages
}

export class Redeem extends plugin {
  constructor () {
    super({
      name: '[TaJiDuo-plugin] 兑换码',
      dsc: 'TaJiDuo 兑换码查询',
      event: 'message',
      priority: 90,
      rule: [
        { reg: buildCommandReg('兑换码'), fnc: 'listAllRedeemCodes' },
        { reg: buildCommandReg('幻塔兑换码'), fnc: 'listHuantaRedeemCodes' },
        { reg: buildCommandReg('异环兑换码'), fnc: 'listYihuanRedeemCodes' }
      ]
    })

    this.api = new TaJiDuoApi()
  }

  async listAllRedeemCodes () {
    return this.handleRedeemQuery('all')
  }

  async listHuantaRedeemCodes () {
    return this.handleRedeemQuery('huanta')
  }

  async listYihuanRedeemCodes () {
    return this.handleRedeemQuery('yihuan')
  }

  async handleRedeemQuery (commandKey = 'all') {
    const config = REDEEM_COMMAND_CONFIG[commandKey] || REDEEM_COMMAND_CONFIG.all

    try {
      await this.reply(`${config.title}查询中，请稍候...`)
      const data = await this.api.listRedeemCodes(config.gameCode ? { gameCode: config.gameCode } : {})
      const items = getRedeemItems(data)
      const messages = buildRedeemMessages(config.title, items, config.gameCode)
      await this.replyForwardMessages(config.forwardTitle, messages)
    } catch (error) {
      await this.reply(`${config.title}失败：${getErrorMessage(error)}`)
    }

    return true
  }

  async replyForwardMessages (title = '', messages = []) {
    if (!Array.isArray(messages) || messages.length === 0) {
      await this.reply(`${title}\n暂无可用兑换码`)
      return
    }

    if (messages.length === 1) {
      await this.reply(messages[0])
      return
    }

    const forward = await common.makeForwardMsg(this.e, messages)
    await this.reply(forward)
  }
}
