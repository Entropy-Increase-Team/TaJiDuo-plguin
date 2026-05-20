import TaJiDuoUser from '../../model/tajiduoUser.js'
import setting from '../../utils/setting.js'
import { normalizeCronExpression } from '../../utils/cron.js'
import { withSignLock } from '../../utils/signLock.js'
import {
  GAME,
  getMessage,
  getUnbindMessage,
  summarizeApiError,
  trimMsg
} from '../../utils/common.js'

const COMMUNITY_TASK_POLL_TIMES = 60
const COMMUNITY_TASK_POLL_INTERVAL = 5000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getTaskCron(cronExpression, fallback, taskName) {
  try {
    return normalizeCronExpression(cronExpression || fallback)
  } catch (error) {
    logger.error(`[TaJiDuo-plugin][${taskName}] cron 表达式无效，已回退默认值: ${error?.message || error}`)
    return normalizeCronExpression(fallback)
  }
}

function getRoleId(text = '') {
  return String(text).match(/\d{5,}/)?.[0] || ''
}

function roleLabel(role = {}) {
  return role.roleName || role.name || role.roleId || role.id || '未知角色'
}

function accountLabel(user = {}) {
  return user.nickname || user.tjdUid || '塔吉多账号'
}

function resultOk(res) {
  return !!res && Number(res.code) === 0 && res.data?.success !== false
}

function cleanSignMessage(message = '') {
  return String(message || '').replace(/（gameId=\d+），?/g, '')
}

function stageMessage(stage = {}, fallback = '完成') {
  if (stage.message) return cleanSignMessage(stage.message)
  if (stage.reward) return stage.reward
  if (stage.success === false || stage.status === 'failed') return '失败'
  return fallback
}

function signStatusMessage(data = {}) {
  if (data.success === false) return '签到部分失败'
  return '签到完成'
}

function formatGameSignLines(gameCode, data = {}, communityItem = null) {
  const lines = [`签到：${signStatusMessage(data)}`]

  if (data.app) {
    lines.push(`社区：${stageMessage(data.app)}`)
  } else if (communityItem) {
    lines.push(`社区：${stageMessage(communityItem, communityItem.success === false ? '失败' : '完成')}`)
  }

  const items = Array.isArray(data.games) ? data.games : []
  if (items.length > 0) {
    for (const item of items) {
      const label = roleLabel(item.role || item)
      lines.push(`${label}：${stageMessage(item)}`)
    }
  } else if (!data.app) {
    lines.push('没有返回签到明细')
  }

  return lines
}

function getCommunityTaskId(data = {}) {
  return data.community?.task?.taskId || data.community?.taskId || ''
}

function getCommunityItems(data = {}) {
  const items = data.result?.batch?.items || data.result?.items || data.items || data.batch?.items || []
  return Array.isArray(items) ? items : []
}

function mapCommunityItems(data = {}) {
  const result = {}
  for (const item of getCommunityItems(data)) {
    const gameCode = String(item.gameCode || '').toLowerCase()
    if (gameCode === 'huanta' || gameCode === 'yihuan') result[gameCode] = item
  }
  return result
}

function formatTajiduoSignLines(data = {}, communityTask = null) {
  const lines = []

  if (data.ht) {
    lines.push('【幻塔】')
    lines.push(...formatGameSignLines('huanta', data.ht, communityTask?.items?.huanta))
  }

  if (data.yh) {
    lines.push('【异环】')
    lines.push(...formatGameSignLines('yihuan', data.yh, communityTask?.items?.yihuan))
  }

  if (communityTask?.lines?.length) {
    lines.push(...communityTask.lines)
  }

  if (lines.length === 0) {
    lines.push(data.message || (data.success === false ? '塔吉多签到部分失败' : '塔吉多签到完成'))
  }
  return lines
}

export class BaseSignPlugin extends plugin {
  async getUsers() {
    const userId = this.e.at || this.e.user_id
    const users = await TaJiDuoUser.getAllUsers(userId)
    if (users.length === 0) {
      await this.reply(getUnbindMessage())
      return []
    }
    return users
  }

  async signOne(tjdUser, gameCode = '') {
    const res = await tjdUser.tjdReq.getData('sign_all', { gameCode })
    if (!res || Number(res.code) !== 0) {
      const game = GAME[gameCode]
      const title = game ? `${game.name}签到` : '塔吉多签到'
      return { ok: false, lines: [`${title}失败：${summarizeApiError(res)}`] }
    }

    const data = res.data || {}
    const communityTask = gameCode ? null : await this.pollCommunityTask(tjdUser, getCommunityTaskId(data))
    return {
      ok: resultOk(res) && (communityTask?.ok !== false),
      lines: gameCode ? formatGameSignLines(gameCode, data) : formatTajiduoSignLines(data, communityTask)
    }
  }

  async pollCommunityTask(tjdUser, taskId) {
    if (!taskId) return null

    let latest = null
    for (let i = 0; i < COMMUNITY_TASK_POLL_TIMES; i++) {
      await sleep(COMMUNITY_TASK_POLL_INTERVAL)
      latest = await tjdUser.tjdReq.getData('all_community_task_status', { taskId })
      if (!latest || Number(latest.code) !== 0) {
        return {
          ok: false,
          lines: [`社区任务：${summarizeApiError(latest)}`]
        }
      }
      if (latest.data?.completed || latest.data?.status === 'finished' || latest.data?.status === 'failed') break
    }

    const data = latest?.data
    if (!data) return { ok: false, lines: ['社区任务：没有拿到任务状态'] }
    if (!data.completed && data.status !== 'finished' && data.status !== 'failed') {
      return { ok: false, lines: [`社区任务：仍在执行（${data.status || 'running'}）`] }
    }
    if (data.success === false || data.status === 'failed') {
      return { ok: false, lines: [`社区任务：${data.message || data.error || '失败'}`] }
    }
    return { ok: true, items: mapCommunityItems(data), lines: [] }
  }

  async sign(gameCode) {
    const game = GAME[gameCode]
    return withSignLock(this, `${game.name}签到`, async () => {
      const users = await this.getUsers()
      if (users.length === 0) return true

      await this.reply(getMessage('game.sign_start', { game: game.name }))
      const lines = [getMessage('game.sign_done', { game: game.name })]
      for (const user of users) {
        const title = accountLabel(user)
        const result = await this.signOne(user, gameCode)
        lines.push(`【${title}】`)
        lines.push(...result.lines)
      }
      await this.reply(lines.join('\n'))
      return true
    })
  }

  async tajiduoSign() {
    return withSignLock(this, '塔吉多签到', async () => {
      const users = await this.getUsers()
      if (users.length === 0) return true

      await this.reply('开始执行塔吉多签到...')
      const lines = ['塔吉多签到完成']
      for (const user of users) {
        const result = await this.signOne(user)
        lines.push(...result.lines)
      }
      await this.reply(lines.join('\n'))
      return true
    })
  }

  async signState(gameCode) {
    const game = GAME[gameCode]
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('sign_state', { gameCode })
      if (!res || Number(res.code) !== 0) {
        lines.push(`${user.nickname || user.tjdUid || '账号'}：${summarizeApiError(res)}`)
        continue
      }
      const data = res.data || {}
      const state = data.todaySign ? getMessage('game.already_signed') : getMessage('game.not_signed')
      lines.push(`${user.nickname || user.tjdUid || '账号'}：${state}，本月${data.days ?? 0}天，补签${data.reSignCnt ?? 0}次`)
    }
    await this.reply(getMessage('game.sign_state', { game: game.name, state: '\n' + lines.join('\n') }))
    return true
  }

  async resign(gameCode) {
    const game = GAME[gameCode]
    const roleId = getRoleId(trimMsg(this.e))
    if (!roleId) {
      await this.reply(getMessage('game.resign_usage', { game: game.name }))
      return true
    }

    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('sign_resign', { gameCode, roleId })
      if (!res || Number(res.code) !== 0) {
        lines.push(`${user.nickname || user.tjdUid || '账号'}：${summarizeApiError(res)}`)
      } else {
        lines.push(`${user.nickname || user.tjdUid || '账号'}：${res.message || res.data?.upstream?.message || '完成'}`)
      }
    }
    await this.reply(getMessage('game.resign_done', { game: game.name, message: '\n' + lines.join('\n') }))
    return true
  }

  async runSignTask(gameCode = '', manual = false) {
    if (!redis) return { total: 0, success: 0, fail: 0, lines: ['redis 不可用'] }
    const keys = await redis.keys('TJD:USER:*')
    const stats = { total: 0, success: 0, fail: 0, lines: [] }
    for (const key of keys) {
      const userId = key.replace(/^TJD:USER:/, '')
      const users = await TaJiDuoUser.getAllUsers(userId, { log: false })
      for (const user of users) {
        stats.total++
        const result = await this.signOne(user, gameCode)
        if (result.ok) stats.success++
        else stats.fail++
        if (manual) {
          stats.lines.push(`${userId}/${user.nickname || user.tjdUid || '账号'}：${result.lines.join('；')}`)
        }
      }
    }
    return stats
  }

  async autoSignTask() {
    this.setting = setting.getConfig('sign') || {}
    if (this.setting.auto_sign === false) return true

    const lines = []
    const huantaStats = await this.runSignTask('huanta')
    const yihuanStats = await this.runSignTask('yihuan')
    lines.push(`幻塔签到：账号 ${huantaStats.total}，成功 ${huantaStats.success}，失败 ${huantaStats.fail}`)
    lines.push(`异环签到：账号 ${yihuanStats.total}，成功 ${yihuanStats.success}，失败 ${yihuanStats.fail}`)
    await this.sendNotifyList(lines.join('\n'))
    return true
  }

  async sendNotifyList(msg) {
    const cfg = this.setting?.notify_list || {}
    const friendIds = Array.isArray(cfg.friend) ? cfg.friend : []
    const groupIds = Array.isArray(cfg.group) ? cfg.group : []
    for (const id of friendIds) {
      if (!id) continue
      try {
        if (Bot?.pickUser) await Bot.pickUser(id).sendMsg(msg)
        else if (Bot?.sendPrivateMsg) await Bot.sendPrivateMsg(id, msg)
      } catch (error) {
        logger.error(`[TaJiDuo-plugin][自动签到]通知好友 ${id} 失败：${error?.message || error}`)
      }
    }
    for (const id of groupIds) {
      if (!id) continue
      try {
        if (Bot?.pickGroup) await Bot.pickGroup(id).sendMsg(msg)
      } catch (error) {
        logger.error(`[TaJiDuo-plugin][自动签到]通知群 ${id} 失败：${error?.message || error}`)
      }
    }
  }
}
