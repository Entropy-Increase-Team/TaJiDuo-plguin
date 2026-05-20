import setting from '../../utils/setting.js'
import { getMessage, PREFIX } from '../../utils/common.js'

export class help extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]帮助',
      dsc: '塔吉多插件帮助',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: `^(?:${PREFIX.tajiduo}|${PREFIX.huanta}|${PREFIX.yihuan})(帮助|help)$`,
          fnc: 'help'
        }
      ]
    })
  }

  async help() {
    const helpSetting = setting.getConfig('help') || {}
    const groups = helpSetting.help_group || []
    const menuSections = groups.map((group) => ({
      title: group.group || '',
      items: (group.list || []).map((item) => {
        if (typeof item === 'string') {
          const parts = item.split(/\s+-\s+|\s+：\s+|\s+:\s+/)
          return {
            command: parts[0] || item,
            description: parts.slice(1).join(' - ')
          }
        }
        return {
          command: item.title || item.command || '',
          description: item.desc || item.description || ''
        }
      })
    }))
    const notes = [
      '塔吉多/tjd 管平台账号，幻塔/ht 管幻塔，异环/yh 管异环。',
      '网页登录或短信登录成功后会自动保存账号，可用「塔吉多登录列表」查看。',
      '社区任务会在后台执行，完成前请稍等片刻。'
    ]

    if (this.e?.runtime?.render) {
      try {
        return await this.e.runtime.render('TaJiDuo-plugin', 'menu/index', {
          pageTitle: getMessage('help.title'),
          pageSubtitle: getMessage('prefixTips'),
          menuSections,
          notesTitle: '说明',
          notes,
          viewport: { width: 724 }
        }, {
          scale: 1.45
        })
      } catch (error) {
        logger.error(`[TaJiDuo-plugin][帮助]渲染失败：${error?.message || error}`)
      }
    }

    const lines = [
      getMessage('help.title'),
      getMessage('prefixTips'),
      ''
    ]

    for (const group of groups) {
      lines.push(`【${group.group}】`)
      const list = group.list || []
      for (let i = 0; i < list.length; i += 3) {
        lines.push(list.slice(i, i + 3).join(' | '))
      }
      lines.push('')
    }

    await this.reply(lines.join('\n').trim())
    return true
  }
}
