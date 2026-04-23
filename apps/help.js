import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import plugin from '../../../lib/plugins/plugin.js'
import { pluginName, pluginRoot } from '../model/path.js'
import { joinLines } from '../utils/common.js'
import { buildCommandReg } from '../utils/command.js'

const DEFAULT_HELP_PATH = path.join(pluginRoot, 'config', 'help_default.yaml')
const USER_HELP_PATH = path.join(pluginRoot, 'config', 'config', 'help.yaml')

const FALLBACK_HELP_CONFIG = Object.freeze({
  help: {
    title: '塔吉多插件帮助',
    groups: [
      {
        title: '帮助命令',
        list: [
          { title: 'tjd帮助 / tof帮助 / ht帮助 / nte帮助 / yh帮助', desc: '查看插件帮助' }
        ]
      }
    ],
    notes: [
      '命令前缀支持：tjd / tof / ht / 幻塔 / nte / yh / 异环'
    ]
  }
})

function isPlainObject (value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge (base, override) {
  if (override == null || typeof override !== 'object') {
    return override ?? base
  }

  if (Array.isArray(override)) {
    return override
  }

  const output = {
    ...(isPlainObject(base) ? base : {})
  }

  for (const key of Object.keys(override)) {
    output[key] = deepMerge(output[key], override[key])
  }

  return output
}

function loadYaml(filePath = '') {
  if (!filePath || !fs.existsSync(filePath)) {
    return {}
  }

  try {
    return YAML.parse(fs.readFileSync(filePath, 'utf8')) || {}
  } catch (error) {
    logger.error(`[TaJiDuo-plugin] 读取帮助配置失败：${path.basename(filePath)}`, error)
    return {}
  }
}

function getHelpConfig () {
  const defaultConfig = loadYaml(DEFAULT_HELP_PATH)
  const userConfig = loadYaml(USER_HELP_PATH)
  const merged = deepMerge(defaultConfig, userConfig)
  return isPlainObject(merged?.help) ? merged.help : FALLBACK_HELP_CONFIG.help
}

function buildGroupLines (group = {}) {
  const lines = [`${group.title || '未命名分组'}：`]
  const list = Array.isArray(group?.list) ? group.list : []

  for (const item of list) {
    const title = String(item?.title || '').trim()
    const desc = String(item?.desc || '').trim()
    if (!title && !desc) {
      continue
    }

    lines.push(`${title}${desc ? ` ${desc}` : ''}`)
  }

  return lines
}

function buildHelpMessage (helpConfig = getHelpConfig()) {
  const lines = [String(helpConfig?.title || '塔吉多插件帮助').trim() || '塔吉多插件帮助']
  const groups = Array.isArray(helpConfig?.groups) ? helpConfig.groups : []
  const notes = Array.isArray(helpConfig?.notes) ? helpConfig.notes : []

  for (const group of groups) {
    lines.push('', ...buildGroupLines(group))
  }

  if (notes.length > 0) {
    lines.push('', '说明：')
    notes.forEach((note, index) => {
      lines.push(`${index + 1}. ${note}`)
    })
  }

  return joinLines(lines)
}

function buildRenderData (helpConfig = getHelpConfig()) {
  const groups = Array.isArray(helpConfig?.groups) ? helpConfig.groups : []
  const notes = Array.isArray(helpConfig?.notes) ? helpConfig.notes.filter(Boolean) : []

  return {
    pageTitle: String(helpConfig?.title || '塔吉多插件帮助').trim() || '塔吉多插件帮助',
    notesTitle: '说明',
    notes,
    menuSections: groups.map((group) => ({
      title: String(group?.title || '未命名分组').trim(),
      items: (Array.isArray(group?.list) ? group.list : [])
        .map((item) => ({
          command: String(item?.title || '').trim(),
          description: String(item?.desc || '').trim()
        }))
        .filter((item) => item.command || item.description)
    }))
  }
}

export class Help extends plugin {
  constructor () {
    super({
      name: '[TaJiDuo-plugin] 帮助',
      dsc: 'TaJiDuo 插件帮助',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: buildCommandReg('(?:帮助|菜单|命令|help)', ['general', 'huanta', 'yihuan']),
          fnc: 'showHelp'
        }
      ]
    })
  }

  async showHelp () {
    const helpConfig = getHelpConfig()

    try {
      const image = await this.e.runtime.render(pluginName, 'render/menu/index', buildRenderData(helpConfig), {
        scale: 1.4,
        retType: 'base64'
      })

      if (image) {
        await this.reply(image)
        return true
      }
    } catch (error) {
      logger.error(`[TaJiDuo-plugin] 帮助渲染失败`, error)
    }

    await this.reply(buildHelpMessage(helpConfig))
    return true
  }
}
