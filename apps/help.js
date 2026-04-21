import plugin from '../../../lib/plugins/plugin.js'
import { joinLines } from '../utils/common.js'
import { buildCommandReg, formatCommand, formatCommandList } from '../utils/command.js'

const HELP_GROUPS = Object.freeze([
  {
    title: '帮助命令',
    list: [
      ['帮助', '查看插件帮助']
    ]
  },
  {
    title: '登录命令',
    list: [
      ['登录 13800138000', '发送验证码并等待下一条 6 位验证码'],
      ['账号', '查看当前登录账号'],
      ['刷新登录', '刷新当前登录账号'],
      ['退出登录', '退出当前登录'],
      ['删除账号', '删除当前登录账号']
    ]
  },
  {
    title: '社区命令',
    list: [
      ['异环社区签到', '提交异环社区签到任务并等待结果'],
      ['幻塔社区签到', '提交幻塔社区签到任务并等待结果'],
      ['社区签到', '提交幻塔 + 异环社区签到任务并使用合并转发展示结果'],
      ['异环社区查询', '查询异环社区状态与任务进度'],
      ['幻塔社区查询', '查询幻塔社区状态与任务进度'],
      ['社区查询', '查询幻塔 + 异环社区状态与任务进度']
    ]
  },
  {
    title: '兑换码命令',
    list: [
      ['异环兑换码', '查看异环当前可用兑换码'],
      ['幻塔兑换码', '查看幻塔当前可用兑换码'],
      ['兑换码', '查看当前全部可用兑换码']
    ]
  }
])

const HELP_NOTES = Object.freeze([
  `命令前缀支持：${formatCommandList('')}`,
  `只有 ${formatCommandList('登录 <手机号>')} 和后续 6 位验证码需要私聊发送`,
  `${formatCommand('账号')}、${formatCommand('刷新登录')}、${formatCommand('退出登录')}、${formatCommand('删除账号')} 支持群聊触发`,
  `${formatCommand('兑换码')}、${formatCommand('幻塔兑换码')}、${formatCommand('异环兑换码')} 不需要登录即可使用`,
  '已登录账号会在每天 00:20 自动执行社区签到'
])

function buildGroupLines (group = {}) {
  const lines = [`${group.title}：`]

  for (const [command, description] of group.list || []) {
    lines.push(`${formatCommand(command)} ${description}`)
  }

  return lines
}

function buildHelpMessage () {
  const lines = ['TaJiDuo-plugin']

  for (const group of HELP_GROUPS) {
    lines.push('', ...buildGroupLines(group))
  }

  lines.push('', '说明：')

  HELP_NOTES.forEach((note, index) => {
    lines.push(`${index + 1}. ${note}`)
  })

  return joinLines(lines)
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
          reg: buildCommandReg('(?:帮助|菜单|命令|help)'),
          fnc: 'showHelp'
        }
      ]
    })
  }

  async showHelp () {
    await this.reply(buildHelpMessage())
    return true
  }
}
