import { PREFIX } from '../../utils/common.js'
import {
  YihuanBase,
  compactLine,
  dataBody,
  filterByQuery,
  getCommandArgs,
  getMessage,
  isOwned,
  itemName,
  pickBestItem,
  queryLabel,
  summarizeApiError,
  toArray,
  trimMsg
} from './shared/core.js'

function vehicleStatLine(item = {}) {
  const name = item.name || item.id || item.key || item.type
  const value = item.value ?? item.val ?? item.num
  const max = item.max ?? item.total
  if (!name) return ''
  if (value === undefined || value === '') return name + '：暂无'
  return max !== undefined && max !== '' ? name + '：' + value + '/' + max : name + '：' + value
}

function formatVehicleStats(items = []) {
  return toArray(items).map(vehicleStatLine).filter(Boolean)
}

function formatVehicleDetailLines(item = {}) {
  const base = formatVehicleStats(item.base)
  const advanced = formatVehicleStats(item.advanced)
  const lines = [
    compactLine('名称', itemName(item)),
    compactLine('状态', isOwned(item) ? '已拥有' : '未拥有')
  ]
  if (base.length) lines.push('基础属性：', ...base)
  if (advanced.length) lines.push('高级参数：', ...advanced)
  if (base.length === 0 && advanced.length === 0) lines.push('暂无详细参数')
  return lines
}

export class yihuanVehicles extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环载具',
      dsc: '异环载具查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(载具数据|我的载具|载具)(?:\\s*.*)?$',
          fnc: 'yihuanVehicles'
        }
      ]
    })
  }

  async yihuanVehicles() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const args = getCommandArgs(trimMsg(this.e), 'yihuan', '(?:载具数据|载具)')
    const resolved = await this.resolveGameRole(tjdUser, 'yihuan', args)
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_vehicles', { roleId: role.roleId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = dataBody(res)
    const allDetail = toArray(data.detail)
    const detail = filterByQuery(allDetail, resolved.query)
    const lines = ['异环载具：' + (role.roleName || role.roleId) + queryLabel(resolved.query)]
    if (resolved.query) {
      const vehicle = pickBestItem(detail, resolved.query)
      if (vehicle) {
        lines.push(...formatVehicleDetailLines(vehicle))
        if (detail.length > 1) lines.push('匹配到 ' + detail.length + ' 个结果，已展示：' + itemName(vehicle))
      } else {
        lines.push('未找到匹配：' + resolved.query)
      }
    } else {
      lines.push(compactLine('拥有', (data.ownCnt ?? allDetail.filter((entry) => isOwned(entry)).length) + '/' + (data.total ?? allDetail.length)))
      for (const item of allDetail.filter((entry) => isOwned(entry)).slice(0, 8)) lines.push('- ' + itemName(item))
      if (allDetail.length === 0) lines.push(getMessage('common.no_data'))
    }
    await this.reply(lines.join('\n'))
    return true
  }
}
