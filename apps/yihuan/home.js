import { PREFIX } from '../../utils/common.js'
import {
  YihuanBase,
  compactLine,
  dataBody,
  enumLabel,
  filterByQuery,
  getCommandArgs,
  getMessage,
  queryLabel,
  summarizeApiError,
  toArray,
  trimMsg
} from './shared/core.js'

function isTruthyFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function itemName(item = {}) {
  return item.name || item.showName || item.title || item.id || item.ID || '未命名'
}

function homeDisplayLabel(item = {}, showCount = false) {
  if (!item || Object.keys(item).length === 0) return '暂无'
  const visible = [
    item.own,
    item.owned,
    item.unlock,
    item.has,
    item.show,
    item.selected,
    item.display,
    item.displayed,
    item.isShow
  ].some(isTruthyFlag)
  if (!visible) return '暂无'

  const name = item.showName || item.name || item.title || itemName(item)
  if (!name || name === '未命名') return '暂无'
  if (!showCount) return name

  const ownCnt = item.ownCnt ?? item.ownedCnt ?? item.count
  const total = item.total
  if (ownCnt !== undefined && total !== undefined) return name + ' ' + ownCnt + '/' + total
  if (total !== undefined) return name + ' ' + total
  return name
}

function characterSummary(item = {}) {
  return '' + (item.name || item.id || '角色')
    + (item.quality ? ' / ' + enumLabel(item.quality) : '')
    + (item.alev !== undefined ? ' / Lv.' + item.alev : '')
    + (item.slev !== undefined ? ' / 阶段' + item.slev : '')
    + (item.awakenLev !== undefined ? ' / 觉醒' + item.awakenLev : '')
}

export class yihuanHome extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环主页',
      dsc: '异环角色主页查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '(角色主页|主页)(?:\\s*.*)?$',
          fnc: 'yihuanHome'
        }
      ]
    })
  }

  async yihuanHome() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const args = getCommandArgs(trimMsg(this.e), 'yihuan', '(?:角色主页|主页)')
    const resolved = await this.resolveGameRole(tjdUser, 'yihuan', args)
    const role = resolved.role

    const res = await tjdUser.tjdReq.getData('yihuan_role_home', role?.roleId ? { roleId: role.roleId } : {})
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = dataBody(res)
    const achieve = data.achieveProgress || {}
    const estate = data.realestate || {}
    const vehicle = data.vehicle || {}
    const characters = filterByQuery(toArray(data.characters), resolved.query)
    const uid = data.roleid || data.roleId || data.uid || role?.roleId
    const lines = [
      '异环角色主页：' + (data.rolename || role?.roleName || uid || '异环') + queryLabel(resolved.query),
      compactLine('UID', uid),
      compactLine('等级', data.lev),
      compactLine('世界等级', data.worldlevel),
      compactLine('登录天数', data.roleloginDays),
      compactLine('角色数量', data.charidCnt),
      compactLine('成就', (achieve.achievementCnt ?? 0) + '/' + (achieve.total ?? 0)),
      compactLine('房产', homeDisplayLabel(estate)),
      compactLine('载具', homeDisplayLabel(vehicle, true))
    ]
    if (resolved.query) {
      for (const item of characters.slice(0, 6)) lines.push('- ' + characterSummary(item))
      if (characters.length === 0) lines.push('未找到匹配：' + resolved.query)
    }
    await this.reply(lines.join('\n'))
    return true
  }
}
