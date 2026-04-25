import TaJiDuoUser from '../model/tajiduoUser.js'
import setting from '../utils/setting.js'
import { normalizeCronExpression } from '../utils/cron.js'
import { withSignLock } from '../utils/signLock.js'
import {
  GAME,
  getMessage,
  getUnbindMessage,
  normalizeRole,
  PREFIX,
  summarizeApiError,
  trimMsg
} from '../utils/common.js'

function getTaskCron(cronExpression, fallback, taskName) {
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

export class gamesign extends plugin {
  constructor() {
    const signConfig = setting.getConfig('sign') || {}
    super({
      name: '[TaJiDuo-plugin]游戏签到',
      dsc: '幻塔/异环游戏签到',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}签到$`,
          fnc: 'tajiduoSign'
        },
        {
          reg: `^${PREFIX.huanta}签到$`,
          fnc: 'huantaSign'
        },
        {
          reg: `^${PREFIX.yihuan}签到$`,
          fnc: 'yihuanSign'
        },
        {
          reg: `^${PREFIX.huanta}签到状态$`,
          fnc: 'huantaSignState'
        },
        {
          reg: `^${PREFIX.yihuan}签到状态$`,
          fnc: 'yihuanSignState'
        },
        {
          reg: `^${PREFIX.huanta}补签(?:\\s*\\d+)?$`,
          fnc: 'huantaResign'
        },
        {
          reg: `^${PREFIX.yihuan}补签(?:\\s*\\d+)?$`,
          fnc: 'yihuanResign'
        },
        {
          reg: `^${PREFIX.huanta}全部签到$`,
          fnc: 'huantaSignTask',
          permission: 'master'
        },
        {
          reg: `^${PREFIX.yihuan}全部签到$`,
          fnc: 'yihuanSignTask',
          permission: 'master'
        }
      ]
    })

    this.setting = signConfig
    this.task = {
      cron: getTaskCron(this.setting.auto_sign_cron, '10 1 * * *', '塔吉多自动签到'),
      name: 'TaJiDuo-plugin 自动签到',
      fnc: () => this.autoSignTask()
    }
  }

  async getUsers() {
    const userId = this.e.at || this.e.user_id
    const users = await TaJiDuoUser.getAllUsers(userId)
    if (users.length === 0) {
      await this.reply(getUnbindMessage())
      return []
    }
    return users
  }

  async signOne(tjdUser, gameCode) {
    const game = GAME[gameCode]
    if (!game) return { ok: false, lines: ['未知游戏'] }

    const rolesRes = await tjdUser.tjdReq.getData('game_roles', { gameCode })
    if (!rolesRes || Number(rolesRes.code) !== 0) {
      return { ok: false, lines: [getMessage('game.sign_failed', { game: game.name, message: summarizeApiError(rolesRes) })] }
    }
    const roles = (rolesRes.data?.roles || []).map(normalizeRole).filter((role) => role.roleId)
    if (roles.length === 0) {
      return { ok: false, lines: [getMessage('game.roles_empty', { game: game.name })] }
    }

    const lines = []
    for (const role of roles) {
      const res = await tjdUser.tjdReq.getData('sign_game', { gameCode, roleId: role.roleId })
      if (!res || Number(res.code) !== 0) {
        lines.push(`${roleLabel(role)}：${summarizeApiError(res)}`)
      } else {
        lines.push(`${roleLabel(role)}：${res.data?.message || res.data?.upstream?.message || res.message || '完成'}`)
      }
    }

    return { ok: true, lines }
  }

  async sign(gameCode) {
    const game = GAME[gameCode]
    return withSignLock(this, `${game.name}签到`, async () => {
      const users = await this.getUsers()
      if (users.length === 0) return true

      await this.reply(getMessage('game.sign_start', { game: game.name }))
      const lines = [getMessage('game.sign_done', { game: game.name })]
      for (const user of users) {
        const title = user.nickname || user.tjdUid || '塔吉多账号'
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
        const title = user.nickname || user.tjdUid || '塔吉多账号'
        lines.push(`【${title}】`)
        for (const gameCode of ['huanta', 'yihuan']) {
          const game = GAME[gameCode]
          const result = await this.signOne(user, gameCode)
          lines.push(`【${game.name}】`)
          lines.push(...result.lines)
        }
      }
      await this.reply(lines.join('\n'))
      return true
    })
  }

  async huantaSign() {
    return this.sign('huanta')
  }

  async yihuanSign() {
    return this.sign('yihuan')
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

  async huantaSignState() {
    return this.signState('huanta')
  }

  async yihuanSignState() {
    return this.signState('yihuan')
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

  async huantaResign() {
    return this.resign('huanta')
  }

  async yihuanResign() {
    return this.resign('yihuan')
  }

  async runSignTask(gameCode, manual = false) {
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

  async signTask(gameCode) {
    if (!this.e?.isMaster) return false
    const game = GAME[gameCode]
    return withSignLock(this, `${game.name}全部签到`, async () => {
      const stats = await this.runSignTask(gameCode, true)
      const lines = [
        `${game.name}全部签到完成`,
        `账号：${stats.total}，成功：${stats.success}，失败：${stats.fail}`,
        ...stats.lines.slice(0, 30)
      ]
      if (stats.lines.length > 30) lines.push(`还有 ${stats.lines.length - 30} 条结果未展开`)
      await this.reply(lines.join('\n'))
      return true
    })
  }

  async huantaSignTask() {
    return this.signTask('huanta')
  }

  async yihuanSignTask() {
    return this.signTask('yihuan')
  }

  async autoSignTask() {
    this.setting = setting.getConfig('sign') || {}
    if (this.setting.auto_sign === false) return true

    const games = Array.isArray(this.setting.games) && this.setting.games.length > 0
      ? this.setting.games
      : ['huanta', 'yihuan']
    const lines = ['TaJiDuo-plugin 自动签到完成']
    for (const gameCode of games) {
      if (!GAME[gameCode]) continue
      const stats = await this.runSignTask(gameCode)
      lines.push(`${GAME[gameCode].name}：账号 ${stats.total}，成功 ${stats.success}，失败 ${stats.fail}`)
    }
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
