import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import plugin from '../../../lib/plugins/plugin.js'
import { pluginName } from '../model/path.js'
import { buildCommandReg } from '../utils/command.js'

let UpdatePlugin = null

async function loadOtherUpdate () {
  if (UpdatePlugin) {
    return UpdatePlugin
  }

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const otherUpdatePath = path.join(currentDir, '..', '..', 'other', 'update.js')
    const mod = await import(pathToFileURL(otherUpdatePath).href)
    UpdatePlugin = mod?.update ?? mod?.default
  } catch (error) {
    logger?.warn?.('[TaJiDuo-plugin] 未找到 plugins/other/update.js，插件更新命令不可用')
  }

  return UpdatePlugin
}

export class Update extends plugin {
  constructor () {
    super({
      name: '[TaJiDuo-plugin] 更新',
      dsc: 'TaJiDuo 插件更新',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: buildCommandReg('((插件)?(强制)?更新|update)'),
          fnc: 'update',
          permission: 'master'
        }
      ]
    })
  }

  async update () {
    if (!this.e?.isMaster) {
      return false
    }

    const UpdateClass = await loadOtherUpdate()
    if (!UpdateClass) {
      await this.reply('未找到 plugins/other/update.js，当前无法执行插件更新')
      return true
    }

    this.e.msg = `#${this.e.msg.includes('强制') ? '强制' : ''}更新${pluginName}`
    const updater = new UpdateClass()
    updater.e = this.e
    updater.reply = this.reply.bind(this)
    return updater.update()
  }
}
