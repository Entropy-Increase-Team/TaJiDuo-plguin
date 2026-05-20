import { PREFIX } from '../../utils/common.js'
import {
  YihuanBase,
  compactLine,
  countOwned,
  dataBody,
  filterByQuery,
  getCommandArgs,
  getMessage,
  isOwned,
  itemName,
  queryLabel,
  summarizeApiError,
  toArray,
  trimMsg
} from './shared/core.js'

export class yihuanRealEstate extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环房产',
      dsc: '异环房产查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(房产数据|我的房产|房产)(?:\\s*.*)?$',
          fnc: 'yihuanRealEstate'
        }
      ]
    })
  }

  async yihuanRealEstate() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const args = getCommandArgs(trimMsg(this.e), 'yihuan', '(?:房产数据|房产)')
    const resolved = await this.resolveGameRole(tjdUser, 'yihuan', args)
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_real_estate', { roleId: role.roleId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = dataBody(res)
    const allDetail = toArray(data.detail)
    const detail = filterByQuery(allDetail, resolved.query)
    const owned = countOwned(detail)
    const lines = [
      '异环房产：' + (role.roleName || role.roleId) + queryLabel(resolved.query),
      compactLine('拥有', owned + '/' + (resolved.query ? detail.length : allDetail.length))
    ]
    for (const item of detail.filter((entry) => isOwned(entry)).slice(0, 8)) lines.push('- ' + itemName(item))
    if (detail.length === 0) lines.push(resolved.query ? '未找到匹配：' + resolved.query : getMessage('common.no_data'))
    await this.reply(lines.join('\n'))
    return true
  }
}
