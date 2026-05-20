import { PREFIX } from '../../utils/common.js'
import {
  YihuanBase,
  compactLine,
  dataBody,
  enumLabel,
  getMessage,
  summarizeApiError,
  toArray
} from './shared/core.js'

function characterListLine(item = {}) {
  const name = item.name || item.id || '角色'
  const level = item.alev ?? getMessage('common.empty')
  const element = enumLabel(item.elementType) || getMessage('common.empty')
  const stage = item.slev === undefined || item.slev === null || item.slev === '' || Number(item.slev) === 0 ? '无' : item.slev
  const awaken = item.awakenLev ?? 0
  return name + ' | 等级 ' + level + ' | 属性 ' + element + ' | 阶段 ' + stage + ' | 觉醒 ' + awaken
}

function characterName(item = {}) {
  return item.name || item.id || '角色'
}

export class yihuanCharacters extends YihuanBase {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环角色',
      dsc: '异环角色列表刷新/查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: '^' + PREFIX.yihuan + '角色(?:列表)?$',
          fnc: 'yihuanCharacters'
        },
        {
          reg: '^' + PREFIX.yihuan + '(?:[刷更]新面[板版]|面板[刷更]新|强制刷新)$',
          fnc: 'yihuanRefreshPanel'
        }
      ]
    })
  }

  async yihuanCharacters() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const resolved = await this.resolveGameRole(tjdUser, 'yihuan')
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_role_home', role?.roleId ? { roleId: role.roleId } : {})
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = dataBody(res)
    const items = toArray(data.characters)
    const owned = data.charidCnt ?? items.length
    const lines = [
      '异环角色列表：' + (data.rolename || role?.roleName || data.roleid || role?.roleId || '异环'),
      compactLine('拥有', owned + '/' + items.length)
    ]
    for (const item of items) lines.push(characterListLine(item))
    if (items.length === 0) lines.push(getMessage('common.no_data'))
    await this.reply(lines.join('\n'))
    return true
  }

  async yihuanRefreshPanel() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const resolved = await this.resolveGameRole(tjdUser, 'yihuan')
    const role = resolved.role
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_characters', { roleId: role.roleId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const items = toArray(dataBody(res))
    const lines = [
      '异环面板更新完成：' + (role.roleName || role.roleId),
      compactLine('角色', items.length)
    ]
    if (items.length > 0) lines.push(items.map(characterName).join('、'))
    if (items.length === 0) lines.push(getMessage('common.no_data'))
    await this.reply(lines.join('\n'))
    return true
  }
}
