import plugin from '../../../lib/plugins/plugin.js'
import { formatCommand } from '../utils/command.js'
import { joinLines } from '../utils/common.js'

const PLATFORM_ALIAS = '(?:TaJiDuo|tajiduo|TAJIDUO|塔吉多)'

export class TaJiDuoHelp extends plugin {
  constructor (e) {
    super({
      name: '[TaJiDuo-plugin] 帮助',
      dsc: 'TaJiDuo 插件帮助',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: `^(?:#|=)\\s*${PLATFORM_ALIAS}(?:帮助|菜单|命令|help)$`,
          fnc: 'showHelp'
        }
      ]
    })

    this.e = e
  }

  async showHelp () {
    const msg = joinLines([
      'TaJiDuo-plugin',
      '',
      '帮助命令：',
      `${formatCommand('塔吉多帮助')} 查看帮助`,
      '',
      '登录命令：',
      `${formatCommand('塔吉多登录 13800138000')} 发送验证码并等待下一条 6 位验证码`,
      `${formatCommand('塔吉多账号')} 查看当前登录账号`,
      `${formatCommand('塔吉多刷新登录')} 刷新当前登录账号`,
      `${formatCommand('塔吉多退出登录')} 退出当前登录`,
      `${formatCommand('塔吉多删除账号')} 删除当前登录账号`,
      '',
      '签到命令：',
      `${formatCommand('塔吉多异环社区签到')} 提交异环社区签到任务并等待结果`,
      `${formatCommand('塔吉多幻塔社区签到')} 提交幻塔社区签到任务并等待结果`,
      `${formatCommand('塔吉多社区签到')} 提交幻塔 + 异环社区签到任务并等待结果`,
      `${formatCommand('塔吉多异环社区查询')} 查询异环社区状态与任务进度`,
      `${formatCommand('塔吉多幻塔社区查询')} 查询幻塔社区状态与任务进度`,
      `${formatCommand('塔吉多社区查询')} 查询幻塔 + 异环社区状态与任务进度`,
      '',
      '说明：',
      '1. 登录相关命令仅支持私聊使用。',
      '2. 已登录账号会在每天 00:20 自动执行社区签到。'
    ])

    await this.reply(msg)
    return true
  }
}
