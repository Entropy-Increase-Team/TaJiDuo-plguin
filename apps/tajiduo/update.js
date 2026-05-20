import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PREFIX } from '../../utils/common.js'

const execFileAsync = promisify(execFile)
const PLUGIN_DIR = './plugins/TaJiDuo-plugin'

let updating = false

function cleanOutput(value = '') {
  return String(value || '').trim()
}

function shortOutput(value = '', limit = 900) {
  const text = cleanOutput(value)
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n...`
}

export class update extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]更新',
      dsc: '塔吉多插件更新',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}更新$`,
          fnc: 'update',
          permission: 'master'
        },
        {
          reg: `^${PREFIX.tajiduo}强制更新$`,
          fnc: 'forceUpdate',
          permission: 'master'
        },
        {
          reg: `^${PREFIX.yihuan}(更新记录|更新日志)$`,
          fnc: 'updateLog'
        }
      ]
    })
  }

  async git(args = []) {
    return execFileAsync('git', args, {
      cwd: PLUGIN_DIR,
      maxBuffer: 1024 * 1024
    })
  }

  async commitId() {
    try {
      const { stdout } = await this.git(['rev-parse', '--short', 'HEAD'])
      return cleanOutput(stdout) || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async upstreamRef() {
    try {
      const { stdout } = await this.git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
      return cleanOutput(stdout)
    } catch {
      const { stdout } = await this.git(['rev-parse', '--abbrev-ref', 'HEAD'])
      const branch = cleanOutput(stdout) || 'main'
      return `origin/${branch}`
    }
  }

  async runUpdate(force = false) {
    if (!this.e?.isMaster) return false
    if (updating) {
      await this.reply('TaJiDuo-plugin 正在更新，请稍候再试。')
      return true
    }

    updating = true
    const oldCommit = await this.commitId()
    try {
      await this.reply(force ? '开始强制更新 TaJiDuo-plugin...' : '开始更新 TaJiDuo-plugin...')

      let output = ''
      if (force) {
        const upstream = await this.upstreamRef()
        await this.git(['fetch', '--all', '--prune'])
        await this.git(['reset', '--hard', upstream])
        const clean = await this.git(['clean', '-fd'])
        output = clean.stdout || clean.stderr || ''
      } else {
        const ret = await this.git(['pull', '--ff-only'])
        output = `${ret.stdout || ''}${ret.stderr || ''}`
      }

      const newCommit = await this.commitId()
      const lines = [
        oldCommit === newCommit ? 'TaJiDuo-plugin 已是最新。' : 'TaJiDuo-plugin 更新完成。',
        `版本：${oldCommit} -> ${newCommit}`
      ]
      const detail = shortOutput(output)
      if (detail) lines.push(detail)
      await this.reply(lines.join('\n'))
    } catch (error) {
      const detail = shortOutput(`${error?.stderr || ''}\n${error?.stdout || ''}\n${error?.message || error}`)
      await this.reply([
        force ? 'TaJiDuo-plugin 强制更新失败。' : 'TaJiDuo-plugin 更新失败。',
        force ? '请检查远程仓库或网络状态。' : '如果本地修改导致失败，可发送「tjd强制更新」覆盖本地改动。',
        detail
      ].filter(Boolean).join('\n'))
    } finally {
      updating = false
    }
    return true
  }

  async update() {
    return this.runUpdate(false)
  }

  async forceUpdate() {
    return this.runUpdate(true)
  }

  async updateLog() {
    const oldCommit = await this.commitId()
    const lines = [
      'TaJiDuo-plugin 更新记录',
      `当前版本：${oldCommit}`,
      '详细更新内容请查看插件 README 或 git 日志。'
    ]
    await this.reply(lines.join('\n'))
    return true
  }
}
