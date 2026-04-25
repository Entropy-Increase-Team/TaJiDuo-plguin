import setting from './utils/setting.js'
import { pluginInfo, getSchemas } from './guoba/schemas.js'

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(base = {}, override = {}) {
  const out = Array.isArray(base) ? [...base] : { ...base }
  if (!isPlainObject(override)) return Array.isArray(override) ? [...override] : override
  for (const key of Object.keys(override)) {
    const value = override[key]
    if (Array.isArray(value)) {
      out[key] = [...value]
    } else if (isPlainObject(value)) {
      out[key] = deepMerge(isPlainObject(out[key]) ? out[key] : {}, value)
    } else {
      out[key] = value
    }
  }
  return out
}

function setPath(target, path, value) {
  const keys = String(path || '').split('.').filter(Boolean)
  let obj = target
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (i === keys.length - 1) {
      obj[key] = value
    } else {
      if (!isPlainObject(obj[key])) obj[key] = {}
      obj = obj[key]
    }
  }
  return target
}

function getPath(source, path, fallback) {
  const value = String(path || '').split('.').filter(Boolean).reduce((obj, key) => obj?.[key], source)
  return value === undefined ? fallback : value
}

function toNumber(value, fallback) {
  if (value === '' || value === undefined || value === null) return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toOptionalNumber(value) {
  if (value === '' || value === undefined || value === null) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item !== undefined && item !== null && String(item).trim() !== '').map((item) => String(item))
}

function getGroupList() {
  try {
    if (global.Bot?.gl) {
      return Array.from(Bot.gl.values()).map((item) => ({
        label: `${item.group_name || item.group_id}-${item.group_id}`,
        value: String(item.group_id)
      }))
    }
  } catch (error) {}
  return []
}

function normalizeCommon(common = {}) {
  const merged = deepMerge({
    base_url: 'https://tajiduo.shallow.ink',
    api_key: '',
    timeout: 25000,
    login_server: {
      enabled: true,
      port: 25188,
      public_link: 'http://127.0.0.1:25188'
    },
    community_task: {
      action_delay_ms: 3000,
      step_delay_ms: 8000,
      between_communities_ms: 15000,
      poll_times: 8,
      poll_interval_ms: 5000
    }
  }, common)

  merged.timeout = toNumber(merged.timeout, 25000)
  merged.login_server.enabled = merged.login_server.enabled !== false
  merged.login_server.port = toNumber(merged.login_server.port, 25188)
  merged.community_task.action_delay_ms = toNumber(merged.community_task.action_delay_ms, 3000)
  merged.community_task.step_delay_ms = toNumber(merged.community_task.step_delay_ms, 8000)
  merged.community_task.between_communities_ms = toNumber(merged.community_task.between_communities_ms, 15000)
  merged.community_task.poll_times = toNumber(merged.community_task.poll_times, 8)
  merged.community_task.poll_interval_ms = toNumber(merged.community_task.poll_interval_ms, 5000)
  const batchPollTimes = toOptionalNumber(merged.community_task.batch_poll_times)
  if (batchPollTimes === undefined) delete merged.community_task.batch_poll_times
  else merged.community_task.batch_poll_times = batchPollTimes
  return merged
}

function normalizeSign(sign = {}) {
  const merged = deepMerge({
    auto_sign: true,
    auto_sign_cron: '10 1 * * *',
    games: ['huanta', 'yihuan'],
    notify_list: {
      friend: [],
      group: []
    }
  }, sign)

  merged.auto_sign = merged.auto_sign === true
  merged.games = normalizeList(merged.games).filter((item) => ['huanta', 'yihuan'].includes(item))
  if (merged.games.length === 0) merged.games = ['huanta', 'yihuan']
  merged.notify_list.friend = normalizeList(merged.notify_list?.friend)
  merged.notify_list.group = normalizeList(merged.notify_list?.group)
  return merged
}

function normalizeHelp(help = {}) {
  const groups = Array.isArray(help.help_group) ? help.help_group : []
  return {
    help_group: groups
      .map((group) => ({
        group: String(group?.group || '').trim(),
        list: normalizeList(group?.list)
      }))
      .filter((group) => group.group || group.list.length > 0)
  }
}

function assignMessageConfig(result, messageConfig) {
  for (const key of [
    'unbind_message',
    'prefixTips',
    'common.loading',
    'common.query_failed',
    'common.sign_busy',
    'login.captcha_usage',
    'login.captcha_sent',
    'login.web_disabled',
    'login.web_link',
    'login.web_timeout',
    'login.pending_missing',
    'login.login_success',
    'login.account_title',
    'game.sign_start',
    'game.sign_done',
    'game.sign_failed',
    'game.sign_state',
    'game.already_signed',
    'game.not_signed',
    'community.task_start',
    'community.task_done',
    'community.task_running',
    'community.task_failed',
    'community.state',
    'community.level',
    'shop.coin',
    'shop.goods_title',
    'shop.code_title',
    'help.title'
  ]) {
    result[`message.${key}`] = getPath(messageConfig, key, '')
  }
}

export function supportGuoba() {
  const groupList = getGroupList()

  return {
    pluginInfo,
    configInfo: {
      schemas: getSchemas(groupList),
      getConfigData() {
        const common = normalizeCommon(setting.getConfig('common') || {})
        const sign = normalizeSign(setting.getConfig('sign') || {})
        const message = setting.getConfig('message') || {}
        const help = normalizeHelp(setting.getConfig('help') || {})

        const result = {
          base_url: common.base_url,
          api_key: common.api_key,
          timeout: common.timeout,
          'login_server.enabled': common.login_server.enabled,
          'login_server.port': common.login_server.port,
          'login_server.public_link': common.login_server.public_link,
          'community_task.action_delay_ms': common.community_task.action_delay_ms,
          'community_task.step_delay_ms': common.community_task.step_delay_ms,
          'community_task.between_communities_ms': common.community_task.between_communities_ms,
          'community_task.poll_times': common.community_task.poll_times,
          'community_task.poll_interval_ms': common.community_task.poll_interval_ms,
          'community_task.batch_poll_times': common.community_task.batch_poll_times,
          'sign.auto_sign': sign.auto_sign,
          'sign.auto_sign_cron': sign.auto_sign_cron,
          'sign.games': sign.games,
          'sign.notify_list.friend': sign.notify_list.friend,
          'sign.notify_list.group': sign.notify_list.group,
          'help.help_group': help.help_group
        }

        assignMessageConfig(result, message)
        return result
      },
      setConfigData(data, { Result }) {
        try {
          const commonData = {}
          const signData = {}
          const messageData = {}
          const helpData = {}
          const commonFields = new Set([
            'base_url',
            'api_key',
            'timeout',
            'login_server.enabled',
            'login_server.port',
            'login_server.public_link',
            'community_task.action_delay_ms',
            'community_task.step_delay_ms',
            'community_task.between_communities_ms',
            'community_task.poll_times',
            'community_task.poll_interval_ms',
            'community_task.batch_poll_times'
          ])

          for (const [key, value] of Object.entries(data || {})) {
            if (commonFields.has(key)) {
              setPath(commonData, key, value)
            } else if (key.startsWith('sign.')) {
              setPath(signData, key.replace(/^sign\./, ''), value)
            } else if (key.startsWith('message.')) {
              setPath(messageData, key.replace(/^message\./, ''), value)
            } else if (key.startsWith('help.')) {
              setPath(helpData, key.replace(/^help\./, ''), value)
            }
          }

          if (Object.keys(commonData).length > 0) {
            const currentCommon = normalizeCommon(setting.getConfig('common') || {})
            const nextCommon = normalizeCommon(deepMerge(currentCommon, commonData))
            if (setting.setConfig('common', nextCommon) === false) {
              return Result.error('common 配置保存失败，请检查文件权限')
            }
          }

          if (Object.keys(signData).length > 0) {
            const currentSign = normalizeSign(setting.getConfig('sign') || {})
            const nextSign = normalizeSign(deepMerge(currentSign, signData))
            if (setting.setConfig('sign', nextSign) === false) {
              return Result.error('sign 配置保存失败，请检查文件权限')
            }
          }

          if (Object.keys(messageData).length > 0) {
            const currentMessage = setting.getConfig('message') || {}
            const nextMessage = deepMerge(currentMessage, messageData)
            if (setting.setConfig('message', nextMessage) === false) {
              return Result.error('message 配置保存失败，请检查文件权限')
            }
          }

          if (Object.keys(helpData).length > 0) {
            const currentHelp = normalizeHelp(setting.getConfig('help') || {})
            const nextHelp = normalizeHelp(deepMerge(currentHelp, helpData))
            if (setting.setConfig('help', nextHelp) === false) {
              return Result.error('help 配置保存失败，请检查文件权限')
            }
          }

          logger.debug('[TaJiDuo-plugin] 配置已更新 (Guoba)')
          return Result.ok({}, '保存成功~')
        } catch (error) {
          logger.error(`[TaJiDuo-plugin] Guoba 配置保存失败：${error?.message || error}`)
          return Result.error('配置保存失败，请检查日志')
        }
      }
    }
  }
}
