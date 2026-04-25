import TaJiDuoUser from '../model/tajiduoUser.js'
import setting from '../utils/setting.js'
import { withSignLock } from '../utils/signLock.js'
import {
  compactLine,
  GAME,
  getMessage,
  getUnbindMessage,
  PREFIX,
  summarizeApiError
} from '../utils/common.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function flattenTasks(groups = []) {
  const out = []
  for (const group of groups || []) {
    for (const item of group.items || []) {
      out.push(item)
    }
  }
  return out
}

function batchResultLines(data = {}) {
  const source = data.result?.batch?.items || data.result?.items || data.items || []
  const items = Array.isArray(source) ? source : []
  return items.map((item) => {
    const gameName = item.gameName || GAME[item.gameCode]?.name || item.gameCode || '未知游戏'
    return `${gameName}：${item.message || (item.success ? '完成' : '失败')}`
  })
}

export class commsign extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]社区任务',
      dsc: '幻塔/异环社区任务',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}社区(任务|签到)$`,
          fnc: 'tajiduoCommunitySign'
        },
        {
          reg: `^${PREFIX.huanta}社区(任务|签到)$`,
          fnc: 'huantaCommunitySign'
        },
        {
          reg: `^${PREFIX.yihuan}社区(任务|签到)$`,
          fnc: 'yihuanCommunitySign'
        },
        {
          reg: `^${PREFIX.huanta}社区状态$`,
          fnc: 'huantaCommunityState'
        },
        {
          reg: `^${PREFIX.yihuan}社区状态$`,
          fnc: 'yihuanCommunityState'
        },
        {
          reg: `^${PREFIX.huanta}社区等级$`,
          fnc: 'huantaCommunityLevel'
        },
        {
          reg: `^${PREFIX.yihuan}社区等级$`,
          fnc: 'yihuanCommunityLevel'
        },
        {
          reg: `^${PREFIX.huanta}(任务|社区任务列表)$`,
          fnc: 'huantaTasks'
        },
        {
          reg: `^${PREFIX.yihuan}(任务|社区任务列表)$`,
          fnc: 'yihuanTasks'
        }
      ]
    })
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

  getCommunityConfig() {
    const common = setting.getConfig('common') || {}
    return common.community_task || {}
  }

  async communitySign(gameCode) {
    const game = GAME[gameCode]
    return withSignLock(this, `${game.name}社区签到`, async () => {
      const users = await this.getUsers()
      if (users.length === 0) return true

      const cfg = this.getCommunityConfig()
      const lines = []
      for (const user of users) {
        const res = await user.tjdReq.getData('community_sign_all', {
          gameCode,
          actionDelayMs: cfg.action_delay_ms,
          stepDelayMs: cfg.step_delay_ms
        })
        if (!res || Number(res.code) !== 0) {
          lines.push(`【${user.nickname || user.tjdUid || '账号'}】${getMessage('community.task_failed', {
            game: game.name,
            message: summarizeApiError(res)
          })}`)
          continue
        }

        const data = res.data || {}
        lines.push(`【${user.nickname || user.tjdUid || '账号'}】${getMessage('community.task_start', {
          game: game.name,
          taskId: data.taskId || '',
          status: data.status || ''
        })}`)

        const final = await this.pollTask(user, gameCode, data.taskId)
        if (final) lines.push(final)
      }

      await this.reply(lines.join('\n'))
      return true
    })
  }

  async communitySignAll() {
    return withSignLock(this, '塔吉多社区签到', async () => {
      const users = await this.getUsers()
      if (users.length === 0) return true

      const cfg = this.getCommunityConfig()
      const lines = []
      for (const user of users) {
        const res = await user.tjdReq.getData('all_community_sign', {
          gameCodes: ['huanta', 'yihuan'],
          actionDelayMs: cfg.action_delay_ms,
          stepDelayMs: cfg.step_delay_ms,
          betweenCommunitiesMs: cfg.between_communities_ms
        })
        if (!res || Number(res.code) !== 0) {
          lines.push(`【${user.nickname || user.tjdUid || '账号'}】塔吉多社区签到失败：${summarizeApiError(res)}`)
          continue
        }

        const data = res.data || {}
        lines.push(`【${user.nickname || user.tjdUid || '账号'}】已提交塔吉多社区签到：${data.taskId || ''}\n状态：${data.status || ''}`)

        const final = await this.pollAllTask(user, data.taskId)
        if (final) lines.push(final)
      }

      await this.reply(lines.join('\n'))
      return true
    })
  }

  async pollTask(user, gameCode, taskId) {
    if (!taskId) return ''
    const game = GAME[gameCode]
    const cfg = this.getCommunityConfig()
    const times = Math.max(0, Number(cfg.poll_times ?? 8))
    const interval = Math.max(1000, Number(cfg.poll_interval_ms ?? 5000))

    let latest = null
    for (let i = 0; i < times; i++) {
      await sleep(interval)
      latest = await user.tjdReq.getData('community_task_status', { gameCode, taskId })
      if (!latest || Number(latest.code) !== 0) {
        return getMessage('community.task_failed', { game: game.name, message: summarizeApiError(latest) })
      }
      if (latest.data?.completed) break
    }

    const data = latest?.data
    if (!data) return ''
    if (!data.completed) {
      return getMessage('community.task_running', {
        game: game.name,
        status: data.status || 'running',
        taskId
      })
    }
    if (data.success === false || data.status === 'failed') {
      return getMessage('community.task_failed', { game: game.name, message: data.message || '失败' })
    }
    return getMessage('community.task_done', { game: game.name, message: data.message || '完成' })
  }

  async pollAllTask(user, taskId) {
    if (!taskId) return ''
    const cfg = this.getCommunityConfig()
    const baseTimes = Math.max(0, Number(cfg.poll_times ?? 8))
    const times = Math.max(0, Number(cfg.batch_poll_times ?? cfg.all_poll_times ?? baseTimes * 3))
    const interval = Math.max(1000, Number(cfg.poll_interval_ms ?? 5000))

    let latest = null
    for (let i = 0; i < times; i++) {
      await sleep(interval)
      latest = await user.tjdReq.getData('all_community_task_status', { taskId })
      if (!latest || Number(latest.code) !== 0) {
        return `塔吉多社区签到失败：${summarizeApiError(latest)}`
      }
      if (latest.data?.completed) break
    }

    const data = latest?.data
    if (!data) return ''
    if (!data.completed) {
      return `塔吉多社区签到仍在执行：${data.status || 'running'}\n任务 ID：${taskId}`
    }
    if (data.success === false || data.status === 'failed') {
      return `塔吉多社区签到失败：${data.message || '失败'}`
    }
    const lines = [`塔吉多社区签到完成：${data.message || '完成'}`]
    lines.push(...batchResultLines(data))
    return lines.join('\n')
  }

  async tajiduoCommunitySign() {
    return this.communitySignAll()
  }

  async huantaCommunitySign() {
    return this.communitySign('huanta')
  }

  async yihuanCommunitySign() {
    return this.communitySign('yihuan')
  }

  async communityState(gameCode) {
    const game = GAME[gameCode]
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('community_sign_state', { gameCode })
      if (!res || Number(res.code) !== 0) {
        lines.push(`${user.nickname || user.tjdUid || '账号'}：${summarizeApiError(res)}`)
        continue
      }
      lines.push(`${user.nickname || user.tjdUid || '账号'}：${res.data?.signed ? '已签到' : '未签到'}`)
    }
    await this.reply(getMessage('community.state', { game: game.name, state: '\n' + lines.join('\n') }))
    return true
  }

  async huantaCommunityState() {
    return this.communityState('huanta')
  }

  async yihuanCommunityState() {
    return this.communityState('yihuan')
  }

  async communityLevel(gameCode) {
    const game = GAME[gameCode]
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('community_exp_level', { gameCode })
      if (!res || Number(res.code) !== 0) {
        lines.push(`${user.nickname || user.tjdUid || '账号'}：${summarizeApiError(res)}`)
        continue
      }
      const data = res.data || {}
      lines.push(getMessage('community.level', {
        game: `${game.name}/${user.nickname || user.tjdUid || '账号'}`,
        level: data.level ?? 0,
        todayExp: data.todayExp ?? 0,
        exp: data.exp ?? 0,
        nextLevelExp: data.nextLevelExp ?? 0
      }))
    }
    await this.reply(lines.join('\n'))
    return true
  }

  async huantaCommunityLevel() {
    return this.communityLevel('huanta')
  }

  async yihuanCommunityLevel() {
    return this.communityLevel('yihuan')
  }

  async tasks(gameCode) {
    const game = GAME[gameCode]
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('community_tasks', { gameCode })
      if (!res || Number(res.code) !== 0) {
        lines.push(`${user.nickname || user.tjdUid || '账号'}：${summarizeApiError(res)}`)
        continue
      }
      const items = flattenTasks(res.data?.groups).slice(0, 12)
      lines.push(`【${game.name}/${user.nickname || user.tjdUid || '账号'}】`)
      if (items.length === 0) {
        lines.push(getMessage('common.no_data'))
      } else {
        for (const item of items) {
          const limit = item.limitTimes ?? item.targetTimes ?? 1
          lines.push(getMessage('community.task_item', {
            title: item.title || item.taskKey || '任务',
            completeTimes: item.completeTimes ?? 0,
            limitTimes: limit
          }))
        }
      }
      lines.push(compactLine('社区ID', res.data?.communityId || game.communityId))
    }
    await this.reply(lines.join('\n'))
    return true
  }

  async huantaTasks() {
    return this.tasks('huanta')
  }

  async yihuanTasks() {
    return this.tasks('yihuan')
  }
}
