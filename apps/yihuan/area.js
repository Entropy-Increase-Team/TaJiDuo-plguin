import { PREFIX } from '../../utils/common.js'
import {
  YihuanBase,
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

function areaTotalLine(item = {}) {
  const progress = item.progress ?? 0
  const total = item.total ?? 0
  return (item.name || item.id || '未命名') + ' | ' + progress + ' | ' + total + ' | ' + percentLabel(progress, total)
}

export class yihuanArea extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环区域探索',
      dsc: '异环区域探索查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(区域探索|探索详情|探索度|探索|区域)(?:\\s*.*)?$',
          fnc: 'yihuanArea'
        }
      ]
    })
  }

  async yihuanArea() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const args = getCommandArgs(trimMsg(this.e), 'yihuan', '(?:区域探索|探索|区域)')
    const resolved = await this.resolveGameRole(tjdUser, 'yihuan', args)
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_area_progress', { roleId: role.roleId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const items = filterByQuery(toArray(dataBody(res)), resolved.query)
    const lines = ['异环区域探索：' + (role.roleName || role.roleId) + queryLabel(resolved.query)]
    if (items.length > 0) lines.push('区域 | 进度 | 总数 | 完成率')
    for (const item of items) lines.push(areaTotalLine(item))
    if (items.length === 0) lines.push(resolved.query ? '未找到匹配：' + resolved.query : getMessage('common.no_data'))
    await this.reply(lines.join('\n'))
    return true
  }
}
