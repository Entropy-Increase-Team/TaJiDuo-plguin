import { PREFIX } from '../../utils/common.js'
import TaJiDuoRequest from '../../model/tajiduoReq.js'
import {
  YihuanBase,
  cleanSpaces,
  compactLine,
  dataBody,
  formatTime,
  getCommandArgs,
  getMessage,
  hasOwn,
  safeSection,
  searchTerms,
  sleep,
  summarizeApiError,
  toArray,
  trimMsg
} from './shared/core.js'

const YIHUAN_GACHA_TASK_POLL_TIMES = 30
const YIHUAN_GACHA_TASK_POLL_INTERVAL = 2000

function yihuanGachaData(res = {}) {
  if (hasOwn(res.data, 'data')) return res.data.data
  return dataBody(res)
}

function yihuanGachaTask(res = {}) {
  const body = res.data || {}
  if (body.task) return body.task
  if (body.data?.task) return body.data.task
  if (body.data && (body.data.taskId || body.data.status)) return body.data
  if (body.taskId || body.status) return body
  return {}
}

function yihuanGachaCacheMissing(res = {}, data = null) {
  return !data || res.data?.cache?.exists === false || data.cache?.exists === false
}

function hasGachaValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function optionalGachaLine(label, value) {
  return hasGachaValue(value) ? compactLine(label, value) : ''
}

function formatGachaTime(item = {}) {
  const timeStamp = Number(item.timeStamp ?? item.timestamp ?? 0)
  if (!Number.isFinite(timeStamp) || timeStamp <= 0) {
    return item.drawAt || item.time || item.createdAt || ''
  }
  return formatTime(timeStamp < 1e12 ? timeStamp * 1000 : timeStamp)
}

function gachaItemName(item = {}) {
  return item.itemName || item.name || item.charName || item.characterName || item.charid || item.charId || item.id || '未知记录'
}

function formatGachaDetailLine(item = {}) {
  const parts = [gachaItemName(item)]
  if (item.rareCount !== undefined && item.rareCount !== '') parts.push(`${item.rareCount} 抽`)
  const time = formatGachaTime(item)
  if (time) parts.push(time)
  if (item.luckyType !== undefined && item.luckyType !== '') parts.push(`类型 ${item.luckyType}`)
  return parts.join(' | ')
}

function buildYihuanGachaMessages(data = {}) {
  if (!data || typeof data !== 'object' || data.cache?.exists === false) {
    return ['异环抽卡分析\n暂无抽卡缓存，请发送 yh同步抽卡 / yh更新抽卡 / yh同步抽卡记录']
  }

  const profile = data.profile || {}
  const summary = data.summary || {}
  const pools = toArray(data.pools || data.gachaDetails)
  const poolDraw = pools.reduce((sum, item) => sum + (Number(item.drawCount) || 0), 0)
  const poolRareValues = pools.map((item) => item.rareCount).filter(hasGachaValue)
  const poolRare = poolRareValues.reduce((sum, value) => sum + (Number(value) || 0), 0)
  const poolRecords = pools.reduce((sum, item) => sum + (Number(item.recordCount) || toArray(item.details).length), 0)
  const rareCount = summary.rareCount ?? data.rareCount ?? (poolRareValues.length ? poolRare : undefined)
  const header = [
    '异环抽卡分析',
    compactLine('角色', data.rolename || data.roleName || data.userid || data.userId),
    compactLine('UID', data.roleid || data.roleId || data.uid || data.accountUid),
    compactLine('等级', data.lev ?? profile.lev),
    optionalGachaLine('欧气评价', data.luckTitle ?? profile.luckTitle),
    compactLine('总抽数', summary.totalDrawCount ?? summary.detailCount ?? data.drawCount ?? poolDraw),
    optionalGachaLine('稀有次数', rareCount),
    compactLine('出货记录数', summary.recordCount ?? poolRecords),
    compactLine('池子数量', summary.poolCount ?? pools.length),
    compactLine('更新时间', data.updatedAt || data.fetchedAt)
  ].filter(Boolean)
  const messages = [header.join('\n')]

  for (const pool of pools) {
    const details = toArray(pool.details)
    const lines = [
      pool.pool || pool.tab || pool.name || '未命名卡池',
      compactLine('抽数', pool.drawCount),
      optionalGachaLine('稀有次数', pool.rareCount),
      compactLine('出货记录数', pool.recordCount ?? details.length),
      optionalGachaLine('平均出货', pool.average),
      optionalGachaLine('超过玩家', pool.playerOver),
      optionalGachaLine('保底', pool.m)
    ].filter(Boolean)
    if (details.length > 0) {
      lines.push('出货明细：')
      details.slice(0, 20).forEach((item, index) => {
        lines.push(`${index + 1}. ${formatGachaDetailLine(item)}`)
      })
      if (details.length > 20) lines.push(`还有 ${details.length - 20} 条记录未展示`)
    } else {
      lines.push('暂无出货记录')
    }
    messages.push(lines.join('\n'))
  }

  if (pools.length === 0) messages.push(getMessage('common.no_data'))
  return messages.filter((message) => cleanSpaces(message))
}

function formatStatsNumber(value) {
  return value === undefined || value === null || value === '' ? '0' : String(value)
}

function buildYihuanGachaStatsMessages(data = {}) {
  const summary = data.summary || {}
  const messages = [[
    '异环全服抽卡统计',
    compactLine('总抽数', formatStatsNumber(summary.totalDraws)),
    compactLine('出货记录数', formatStatsNumber(summary.recordCount ?? summary.rareCount)),
    compactLine('统计用户', formatStatsNumber(summary.totalUsers)),
    compactLine('统计角色', formatStatsNumber(summary.totalRoles)),
    compactLine('最后更新', summary.lastFetchedAt || summary.lastUpdatedAt)
  ].join('\n')]

  const pools = toArray(data.pools)
  if (pools.length) {
    messages.push(safeSection('卡池统计', pools.slice(0, 20).map((pool, index) => {
      const parts = [
        `${index + 1}. ${pool.pool || pool.tab || '未知卡池'}`,
        `${formatStatsNumber(pool.draws)} 抽`,
        `${formatStatsNumber(pool.recordCount ?? pool.rareCount)} 记录`,
        `${formatStatsNumber(pool.users)} 人`,
        `${formatStatsNumber(pool.roles)} 角色`
      ]
      return parts.join(' | ')
    })))
  }

  const items = toArray(data.items)
  if (items.length) {
    messages.push(safeSection('物品统计', items.slice(0, 30).map((item, index) => {
      const parts = [
        `${index + 1}. ${gachaItemName(item)}`,
        item.pool || item.tab,
        `${formatStatsNumber(item.draws)} 次`,
        `${formatStatsNumber(item.users)} 人`,
        `${formatStatsNumber(item.roles)} 角色`
      ].filter(Boolean)
      if (item.averagePity !== undefined && item.averagePity !== null) parts.push(`均抽 ${item.averagePity}`)
      return parts.join(' | ')
    })))
  }

  const roles = toArray(data.roles)
  if (roles.length) {
    messages.push(safeSection('角色统计', roles.slice(0, 20).map((role, index) => {
      return `${index + 1}. ${role.roleName || role.roleId || role.userId || '未知角色'} | ${formatStatsNumber(role.draws)} 抽 | ${formatStatsNumber(role.recordCount)} 记录 | ${formatStatsNumber(role.pools)} 池`
    })))
  }

  if (messages.length === 1) messages.push(getMessage('common.no_data'))
  return messages.filter((message) => cleanSpaces(message))
}

function parseYihuanGachaStatsQuery(text = '') {
  const args = getCommandArgs(text, 'yihuan', '(?:全服抽卡统计|全服抽卡|抽卡全服统计|抽卡全服)')
  const query = {}
  const keywords = []
  for (const token of searchTerms(args)) {
    const kv = token.match(/^([a-zA-Z]+)[=:：](.+)$/)
    if (kv) {
      const key = kv[1]
      const value = kv[2]
      if (['pool', 'tab', 'itemType', 'charid', 'itemId', 'itemName', 'keyword', 'roleId', 'userId', 'from', 'to', 'limit'].includes(key)) {
        query[key] = value
      }
      continue
    }

    if (/^(限定|限定卡池)$/.test(token)) query.pool = '限定卡池'
    else if (/^(常驻|常驻卡池)$/.test(token)) query.pool = '常驻卡池'
    else if (/^(弧盘|弧盘池)$/.test(token)) query.pool = '弧盘池'
    else if (/^(角色|char)$/.test(token)) query.itemType = 'char'
    else if (/^(fork|弧盘)$/.test(token)) query.itemType = 'fork'
    else if (/^\d{1,3}$/.test(token)) query.limit = token
    else keywords.push(token)
  }
  if (keywords.length && !query.keyword && !query.itemName) query.keyword = keywords.join(' ')
  return query
}

export class yihuanGacha extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环抽卡',
      dsc: '异环抽卡同步/分析/全服统计',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(?:更新|同步)抽卡分析$',
          fnc: 'yihuanRefreshGachaAnalysis'
        },
        {
          reg: '^' + PREFIX.yihuan + '(?:更新|同步)抽卡(?:记录)?$',
          fnc: 'yihuanRefreshGacha'
        },
        {
          reg: '^' + PREFIX.yihuan + '(?:全服抽卡统计|全服抽卡|抽卡全服统计|抽卡全服)(?:\\s*.*)?$',
          fnc: 'yihuanGachaStats'
        },
        {
          reg: '^' + PREFIX.yihuan + '(抽卡分析|抽卡统计|抽卡)$',
          fnc: 'yihuanGacha'
        }
      ]
    })
  }

  async replyYihuanGachaAnalysis(data = {}) {
    await this.replyForward(buildYihuanGachaMessages(data), '异环抽卡分析')
    return true
  }

  async yihuanGacha() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const res = await tjdUser.tjdReq.getData('yihuan_gacha')
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = yihuanGachaData(res)
    if (yihuanGachaCacheMissing(res, data)) {
      await this.reply('暂无异环抽卡缓存，已自动提交同步任务，正在等待结果...')
      const result = await this.submitYihuanGachaRefresh(tjdUser)
      if (result.error) {
        await this.reply(getMessage('common.request_failed', { error: result.error }))
        return true
      }
      if (result.timeout) {
        await this.reply(`异环抽卡同步仍在后台执行\n任务ID：${result.task?.taskId || '未知'}\n状态：${result.task?.status || 'pending'}\n稍后可发送 yh抽卡分析 查看缓存结果；后续同步可用 yh同步抽卡 / yh更新抽卡 / yh同步抽卡记录`)
        return true
      }

      await this.replyYihuanGachaAnalysis(result.data)
      return true
    }

    await this.replyYihuanGachaAnalysis(data)
    return true
  }

  async waitYihuanGachaTask(tjdUser, task = {}) {
    let latestTask = task
    for (let i = 0; i < YIHUAN_GACHA_TASK_POLL_TIMES; i++) {
      const status = String(latestTask.status || '').toLowerCase()
      if (status === 'finished' || status === 'failed') break

      await sleep(YIHUAN_GACHA_TASK_POLL_INTERVAL)
      const statusRes = await tjdUser.tjdReq.getData('yihuan_gacha_task_status', { taskId: latestTask.taskId })
      if (!statusRes || Number(statusRes.code) !== 0) {
        return { task: latestTask, error: summarizeApiError(statusRes) }
      }
      latestTask = {
        ...latestTask,
        ...yihuanGachaTask(statusRes)
      }
    }

    const status = String(latestTask.status || '').toLowerCase()
    if (status !== 'finished') {
      return {
        task: latestTask,
        timeout: status !== 'failed',
        error: status === 'failed' ? (latestTask.error || latestTask.message || '抽卡同步任务失败') : ''
      }
    }

    const resultRes = await tjdUser.tjdReq.getData('yihuan_gacha_task_result', { taskId: latestTask.taskId })
    if (!resultRes || Number(resultRes.code) !== 0) {
      return { task: latestTask, error: summarizeApiError(resultRes) }
    }
    return {
      task: {
        ...latestTask,
        ...yihuanGachaTask(resultRes)
      },
      data: yihuanGachaData(resultRes),
      result: resultRes
    }
  }

  async submitYihuanGachaRefresh(tjdUser) {
    const createRes = await tjdUser.tjdReq.getData('yihuan_gacha_task', { forceRefresh: true })
    if (!createRes || Number(createRes.code) !== 0) {
      return { error: summarizeApiError(createRes) }
    }

    const task = yihuanGachaTask(createRes)
    if (!task.taskId) {
      return { error: '后端未返回抽卡刷新任务 ID' }
    }
    return this.waitYihuanGachaTask(tjdUser, task)
  }

  async yihuanRefreshGacha() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    await this.reply('已提交异环抽卡同步任务，正在等待结果...')
    const result = await this.submitYihuanGachaRefresh(tjdUser)
    if (result.error) {
      await this.reply(getMessage('common.request_failed', { error: result.error }))
      return true
    }
    if (result.timeout) {
      await this.reply(`异环抽卡同步仍在后台执行\n任务ID：${result.task?.taskId || '未知'}\n状态：${result.task?.status || 'pending'}\n稍后可发送 yh抽卡分析 查看缓存结果；后续同步可用 yh同步抽卡 / yh更新抽卡 / yh同步抽卡记录`)
      return true
    }

    await this.replyYihuanGachaAnalysis(result.data)
    return true
  }

  async yihuanRefreshGachaAnalysis() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    await this.reply('已提交异环抽卡同步任务，完成后会发送分析结果...')
    const result = await this.submitYihuanGachaRefresh(tjdUser)
    if (result.error) {
      await this.reply(getMessage('common.request_failed', { error: result.error }))
      return true
    }
    if (result.timeout) {
      await this.reply(`异环抽卡同步仍在后台执行\n任务ID：${result.task?.taskId || '未知'}\n状态：${result.task?.status || 'pending'}\n稍后可发送 yh抽卡分析 查看缓存结果；后续同步可用 yh同步抽卡 / yh更新抽卡 / yh同步抽卡记录`)
      return true
    }

    await this.replyYihuanGachaAnalysis(result.data)
    return true
  }

  async yihuanGachaStats() {
    const req = new TaJiDuoRequest('', { log: true })
    const query = parseYihuanGachaStatsQuery(trimMsg(this.e))
    const res = await req.getData('yihuan_gacha_stats', query)
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    await this.replyForward(buildYihuanGachaStatsMessages(dataBody(res)), '异环全服抽卡统计')
    return true
  }
}
