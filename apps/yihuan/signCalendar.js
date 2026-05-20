import TaJiDuoUser from '../../model/tajiduoUser.js'
import {
  GAME,
  PREFIX,
  getUnbindMessage,
  normalizeRole,
  summarizeApiError
} from '../../utils/common.js'

export class yihuanSignCalendar extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环签到日历',
      dsc: '异环签到日历',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(签到日历|签到一览|签到记录|签到历史)$',
          fnc: 'yihuanSignCalendar'
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

  async resolveFirstRole(tjdUser) {
    const rolesRes = await tjdUser.tjdReq.getData('game_roles', { gameCode: 'yihuan' })
    const roles = (rolesRes?.data?.roles || []).map(normalizeRole).filter((role) => role.roleId)
    return roles[0] || null
  }

  async yihuanSignCalendar() {
    const game = GAME.yihuan
    const users = await this.getUsers()
    if (users.length === 0) return true

    const lines = [game.name + '签到日历']
    for (const user of users) {
      const role = await this.resolveFirstRole(user)
      const stateRes = await user.tjdReq.getData('sign_state', { gameCode: 'yihuan' })
      const rewardsRes = await user.tjdReq.getData('sign_rewards', { gameCode: 'yihuan', roleId: role?.roleId })
      if (!stateRes || Number(stateRes.code) !== 0) {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + summarizeApiError(stateRes))
        continue
      }
      if (!rewardsRes || Number(rewardsRes.code) !== 0) {
        lines.push((user.nickname || user.tjdUid || '账号') + '：' + summarizeApiError(rewardsRes))
        continue
      }

      const state = stateRes.data || {}
      const rewards = Array.isArray(rewardsRes.data) ? rewardsRes.data : (rewardsRes.data?.items || rewardsRes.data?.rewards || [])
      lines.push('【' + (role?.roleName || user.nickname || user.tjdUid || '账号') + '】')
      lines.push('本月：' + (state.month ?? '-') + '月 | 累计：' + (state.days ?? 0) + '天 | 今日：' + (state.todaySign ? '已签' : '未签') + ' | 可补签：' + (state.reSignCnt ?? 0))
      for (const [index, reward] of rewards.slice(0, 31).entries()) {
        const mark = index < Number(state.days || 0) ? '✓' : (index === Number(state.days || 0) && !state.todaySign ? '•' : ' ')
        lines.push(mark + ' 第' + (index + 1) + '天 ' + (reward.name || '奖励') + ' x' + (reward.num ?? 1))
      }
    }
    await this.reply(lines.join('\n'))
    return true
  }
}
