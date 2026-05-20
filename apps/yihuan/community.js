import TaJiDuoUser from '../../model/tajiduoUser.js'
import {
  compactLine,
  GAME,
  PREFIX,
  getMessage,
  getUnbindMessage,
  summarizeApiError
} from '../../utils/common.js'

function flattenTasks(groups = []) {
  const out = []
  for (const group of groups || []) {
    for (const item of group.items || []) out.push(item)
  }
  return out
}

export class yihuanCommunity extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环社区任务',
      dsc: '异环社区状态/等级/任务',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '社区状态$',
          fnc: 'yihuanCommunityState'
        },
        {
          reg: '^' + PREFIX.yihuan + '社区等级$',
          fnc: 'yihuanCommunityLevel'
        },
        {
          reg: '^' + PREFIX.yihuan + '(任务|社区任务列表)$',
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

  async yihuanCommunityState() {
    const game = GAME.yihuan
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('community_sign_state', { gameCode: 'yihuan' })
      if (!res || Number(res.code) !== 0) {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + summarizeApiError(res))
        continue
      }
      lines.push((user.nickname || user.tjdUid || '账号') + '：' + (res.data?.signed ? '已签到' : '未签到'))
    }
    await this.reply(getMessage('community.state', { game: game.name, state: '\n' + lines.join('\n') }))
    return true
  }

  async yihuanCommunityLevel() {
    const game = GAME.yihuan
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('community_exp_level', { gameCode: 'yihuan' })
      if (!res || Number(res.code) !== 0) {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + summarizeApiError(res))
        continue
      }
      const data = res.data || {}
      lines.push(getMessage('community.level', {
        game: game.name + '/' + (user.nickname || user.tjdUid || '账号'),
        level: data.level ?? 0,
        todayExp: data.todayExp ?? 0,
        exp: data.exp ?? 0,
        nextLevelExp: data.nextLevelExp ?? 0
      }))
    }
    await this.reply(lines.join('\n'))
    return true
  }

  async yihuanTasks() {
    const game = GAME.yihuan
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('community_tasks', { gameCode: 'yihuan' })
      if (!res || Number(res.code) !== 0) {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + summarizeApiError(res))
        continue
      }
      const items = flattenTasks(res.data?.groups).slice(0, 12)
      lines.push('【' + game.name + '/' + (user.nickname || user.tjdUid || '账号') + '】')
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
}
