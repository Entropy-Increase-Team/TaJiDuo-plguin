import TaJiDuoUser from '../../model/tajiduoUser.js'
import { withSignLock } from '../../utils/signLock.js'
import {
  GAME,
  PREFIX,
  getMessage,
  getUnbindMessage,
  summarizeApiError,
  trimMsg
} from '../../utils/common.js'

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

function formatGameSignLines(data = {}) {
  const lines = ['签到：' + signStatusMessage(data)]
  if (data.app) lines.push('社区：' + stageMessage(data.app))

  const items = Array.isArray(data.games) ? data.games : []
  if (items.length > 0) {
    for (const item of items) lines.push(roleLabel(item.role || item) + '：' + stageMessage(item))
  } else if (!data.app) {
    lines.push('没有返回签到明细')
  }
  return lines
}

export class yihuanSign extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环签到',
      dsc: '异环签到/签到状态/补签',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '签到$',
          fnc: 'yihuanSign'
        },
        {
          reg: '^' + PREFIX.yihuan + '签到状态$',
          fnc: 'yihuanSignState'
        },
        {
          reg: '^' + PREFIX.yihuan + '补签(?:\\s*\\d+)?$',
          fnc: 'yihuanResign'
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

  async signOne(tjdUser) {
    const res = await tjdUser.tjdReq.getData('sign_all', { gameCode: 'yihuan' })
    if (!res || Number(res.code) !== 0) {
      return { ok: false, lines: ['异环签到失败：' + summarizeApiError(res)] }
    }

    const data = res.data || {}
    return {
      ok: resultOk(res),
      lines: formatGameSignLines(data)
    }
  }

  async yihuanSign() {
    const game = GAME.yihuan
    return withSignLock(this, game.name + '签到', async () => {
      const users = await this.getUsers()
      if (users.length === 0) return true

      await this.reply(getMessage('game.sign_start', { game: game.name }))
      const lines = [getMessage('game.sign_done', { game: game.name })]
      for (const user of users) {
        lines.push('【' + accountLabel(user) + '】')
        const result = await this.signOne(user)
        lines.push(...result.lines)
      }
      await this.reply(lines.join('\n'))
      return true
    })
  }

  async yihuanSignState() {
    const game = GAME.yihuan
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('sign_state', { gameCode: 'yihuan' })
      if (!res || Number(res.code) !== 0) {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + summarizeApiError(res))
        continue
      }
      const data = res.data || {}
      const state = data.todaySign ? getMessage('game.already_signed') : getMessage('game.not_signed')
      lines.push((user.nickname || user.tjdUid || '账号') + '：' + state + '，本月' + (data.days ?? 0) + '天，补签' + (data.reSignCnt ?? 0) + '次')
    }
    await this.reply(getMessage('game.sign_state', { game: game.name, state: '\n' + lines.join('\n') }))
    return true
  }

  async yihuanResign() {
    const game = GAME.yihuan
    const roleId = getRoleId(trimMsg(this.e))
    if (!roleId) {
      await this.reply(getMessage('game.resign_usage', { game: game.name }))
      return true
    }

    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = []
    for (const user of users) {
      const res = await user.tjdReq.getData('sign_resign', { gameCode: 'yihuan', roleId })
      if (!res || Number(res.code) !== 0) {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + summarizeApiError(res))
      } else {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + (res.message || res.data?.upstream?.message || '完成'))
      }
    }
    await this.reply(getMessage('game.resign_done', { game: game.name, message: '\n' + lines.join('\n') }))
    return true
  }
}
