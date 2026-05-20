import { PREFIX } from '../../utils/common.js'
import {
  YihuanBase,
  compactLine,
  dataBody,
  filterByQuery,
  getCommandArgs,
  getMessage,
  percentLabel,
  queryLabel,
  summarizeApiError,
  toArray,
  trimMsg
} from './shared/core.js'

export class yihuanAchieve extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环成就',
      dsc: '异环成就进度查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(成就进度|成就)(?:\\s*.*)?$',
          fnc: 'yihuanAchieve'
        }
      ]
    })
  }

  async yihuanAchieve() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const args = getCommandArgs(trimMsg(this.e), 'yihuan', '(?:成就进度|成就)')
    const resolved = await this.resolveGameRole(tjdUser, 'yihuan', args)
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_achieve_progress', { roleId: role.roleId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = dataBody(res)
    const detail = filterByQuery(toArray(data.detail), resolved.query)
    const lines = [
      '异环成就：' + (role.roleName || role.roleId) + queryLabel(resolved.query),
      compactLine('总进度', (data.achievementCnt ?? 0) + '/' + (data.total ?? 0)),
      compactLine('铜', data.bronzeUmdCnt ?? 0),
      compactLine('银', data.silverUmdCnt ?? 0),
      compactLine('金', data.goldUmdCnt ?? 0)
    ]
    if (detail.length > 0) {
      lines.push('-----')
      lines.push('名称 | 进度 | 总数 | 完成率')
      for (const item of detail) {
        const progress = item.progress ?? 0
        const total = item.total ?? 0
        lines.push((item.name || item.id || '未命名') + ' | ' + progress + ' | ' + total + ' | ' + percentLabel(progress, total))
      }
    } else if (resolved.query) {
      lines.push('未找到匹配：' + resolved.query)
    }
    await this.reply(lines.join('\n'))
    return true
  }
}
