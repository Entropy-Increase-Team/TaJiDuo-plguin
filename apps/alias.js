import {
  addYihuanAlias,
  listYihuanAliases,
  removeYihuanAlias
} from '../utils/yihuanAlias.js'
import { PREFIX, trimMsg } from '../utils/common.js'

function parseAction(text = '') {
  const raw = String(text || '').replace(new RegExp(`^${PREFIX.yihuan}\\s*`, 'i'), '').trim()
  const action = raw.match(/^(添加|删除)(?:角色)?(.+?)别名(.+)$/)
  if (action) {
    return {
      action: action[1],
      charName: action[2].trim(),
      alias: action[3].trim()
    }
  }
  const list = raw.match(/^(.+?)别名(?:列表)?$/)
  if (list) {
    return {
      action: '列表',
      charName: list[1].trim(),
      alias: ''
    }
  }
  return null
}

export class alias extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环角色别名',
      dsc: '异环角色别名管理',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.yihuan}(?:添加|删除)(?:角色)?.+别名.+$`,
          fnc: 'yihuanAlias',
          permission: 'master'
        },
        {
          reg: `^${PREFIX.yihuan}.+别名(?:列表)?$`,
          fnc: 'yihuanAlias'
        }
      ]
    })
  }

  async yihuanAlias() {
    const parsed = parseAction(trimMsg(this.e))
    if (!parsed) {
      await this.reply('用法：yh添加早雾别名早柚 / yh早雾别名列表')
      return true
    }

    if (parsed.action === '列表') {
      const data = await listYihuanAliases(parsed.charName)
      await this.reply(`角色【${data.charName}】别名列表：\n${data.aliases.length ? data.aliases.join('\n') : '暂无'}`)
      return true
    }

    const result = parsed.action === '添加'
      ? await addYihuanAlias(parsed.charName, parsed.alias)
      : await removeYihuanAlias(parsed.charName, parsed.alias)
    await this.reply(result.message)
    return true
  }
}
