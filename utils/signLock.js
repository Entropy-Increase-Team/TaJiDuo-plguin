import { getMessage } from './common.js'

const LOCK_KEY = Symbol.for('TaJiDuo-plugin.signLock')

function getLock() {
  if (!globalThis[LOCK_KEY]) {
    globalThis[LOCK_KEY] = {
      running: false,
      name: '',
      token: null,
      startedAt: 0
    }
  }
  return globalThis[LOCK_KEY]
}

export function getRunningSignTask() {
  const lock = getLock()
  return lock.running ? { name: lock.name, startedAt: lock.startedAt } : null
}

export async function withSignLock(ctx, name, fn) {
  const running = getRunningSignTask()
  if (running) {
    await ctx.reply(getMessage('common.sign_busy', { task: running.name || '签到任务' }))
    return true
  }

  const lock = getLock()
  const token = Symbol(name)
  lock.running = true
  lock.name = name
  lock.token = token
  lock.startedAt = Date.now()

  try {
    return await fn()
  } finally {
    if (lock.token === token) {
      lock.running = false
      lock.name = ''
      lock.token = null
      lock.startedAt = 0
    }
  }
}
