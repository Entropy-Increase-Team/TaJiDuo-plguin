import TaJiDuoRequest from '../../../model/tajiduoReq.js'
import TaJiDuoUser from '../../../model/tajiduoUser.js'
import {
  formatTime,
  getGameLabel,
  getMessage,
  getUnbindMessage,
  parseGameFromText,
  summarizeApiError,
  trimMsg
} from '../../../utils/common.js'

function getTab(text = '') {
  const gameCode = parseGameFromText(text)
  if (gameCode === 'huanta') return 'ht'
  if (gameCode === 'yihuan') return 'yh'
  return 'all'
}

function getGameCodeForRedeem(text = '') {
  return parseGameFromText(text)
}

export class BaseShop extends plugin {
  async getCurrentUser() {
    const userId = this.e.at || this.e.user_id
    const tjdUser = new TaJiDuoUser(userId)
    if (!await tjdUser.getUser()) {
      await this.reply(getUnbindMessage())
      return null
    }
    return tjdUser
  }

  async coin() {
    const user = await this.getCurrentUser()
    if (!user) return true

    const res = await user.tjdReq.getData('shop_coin_state')
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = res.data || {}
    await this.reply(getMessage('shop.coin', {
      total: data.total ?? 0,
      todayGet: data.todayGet ?? 0,
      todayTotal: data.todayTotal ?? 0
    }))
    return true
  }

  async goods() {
    const user = await this.getCurrentUser()
    if (!user) return true

    const tab = getTab(trimMsg(this.e))
    const res = await user.tjdReq.getData('shop_goods', { tab, count: 20, version: 0 })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const goods = res.data?.goods || res.data?.items || []
    const lines = [getMessage('shop.goods_title')]
    for (const [index, item] of goods.slice(0, 15).entries()) {
      lines.push(getMessage('shop.goods_line', {
        index: index + 1,
        name: item.name || '未命名商品',
        price: item.price ?? 0,
        stock: item.stock ?? '-',
        id: item.id
      }))
    }
    if (goods.length === 0) lines.push(getMessage('common.no_data'))
    await this.reply(lines.join('\n'))
    return true
  }

  async redeemCodes() {
    const text = trimMsg(this.e)
    const gameCode = getGameCodeForRedeem(text)
    const req = new TaJiDuoRequest('', { log: false })
    const res = await req.getData('redeem_codes', {
      ...(gameCode ? { gameCode } : {}),
      includeExpired: /全部|过期/.test(text) ? 'true' : ''
    })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const items = res.data?.items || []
    const lines = [getMessage('shop.code_title')]
    for (const item of items.slice(0, 20)) {
      lines.push(getMessage('shop.code_line', {
        game: item.gameName || getGameLabel(item.gameCode),
        code: item.code,
        reward: item.exchangeRewards || item.description || '',
        expires: item.expiresAt ? formatTime(item.expiresAt) : '长期'
      }))
    }
    if (items.length === 0) lines.push(getMessage('common.no_data'))
    await this.reply(lines.join('\n'))
    return true
  }

  async records(type) {
    const user = await this.getCurrentUser()
    if (!user) return true

    const api = type === 'income' ? 'shop_coin_income' : 'shop_coin_consume'
    const res = await user.tjdReq.getData(api, { size: 10, version: 0 })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const title = type === 'income' ? '塔塔币获取记录' : '塔塔币消耗记录'
    const lines = [title]
    for (const item of (res.data?.items || []).slice(0, 10)) {
      lines.push(`${item.title || item.typeName || '记录'}：${item.num ?? 0} / ${formatTime(item.createTime)}`)
    }
    if (lines.length === 1) lines.push(getMessage('common.no_data'))
    await this.reply(lines.join('\n'))
    return true
  }

  async incomeRecords() {
    return this.records('income')
  }

  async consumeRecords() {
    return this.records('consume')
  }
}
