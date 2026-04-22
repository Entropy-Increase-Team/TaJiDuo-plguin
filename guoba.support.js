import path from 'node:path'
import Config from './utils/config.js'
import { pluginRoot } from './model/path.js'
import { normalizeNonNegativeInt } from './utils/common.js'

const NUMBER_FIELDS = new Set([
  'request_timeout_ms',
  'captcha_wait_timeout_ms',
  'community_task_timeout_ms',
  'action_delay_ms',
  'step_delay_ms',
  'between_communities_ms'
])

function isPlainObject (value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge (base, override) {
  if (Array.isArray(override)) {
    return [...override]
  }

  if (!isPlainObject(override)) {
    return override ?? base
  }

  const output = { ...(isPlainObject(base) ? base : {}) }
  for (const key of Object.keys(override)) {
    output[key] = deepMerge(output[key], override[key])
  }
  return output
}

function setByPath (target = {}, field = '', value) {
  const keys = String(field || '').split('.').filter(Boolean)
  if (keys.length === 0) {
    return target
  }

  let current = target
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value
      return
    }

    if (!isPlainObject(current[key])) {
      current[key] = {}
    }
    current = current[key]
  })

  return target
}

function normalizeStringList (items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )]
}

function getMergedPluginConfig () {
  return deepMerge(
    Config.getDefaultConfig()?.tajiduo || {},
    Config.getConfig()?.tajiduo || {}
  )
}

function buildSchemas () {
  return [
    {
      label: '基础配置',
      component: 'SOFT_GROUP_BEGIN'
    },
    {
      field: 'base_url',
      label: '后端地址',
      bottomHelpMessage: 'TaJiDuo 后端地址，只填域名也可以，插件会自动补成 https://',
      component: 'Input',
      componentProps: {
        placeholder: 'https://tajiduo.shallow.ink'
      }
    },
    {
      field: 'api_key',
      label: 'API Key',
      bottomHelpMessage: '用于请求 TaJiDuo API 的 X-API-Key',
      component: 'InputPassword',
      componentProps: {
        placeholder: '请输入 API Key'
      }
    },
    {
      field: 'client_id',
      label: '客户端 ID',
      bottomHelpMessage: '会作为 X-Platform-Id 发送，建议填写机器人 QQ 或其它 ASCII 标识',
      component: 'Input',
      componentProps: {
        placeholder: '请输入客户端 ID'
      }
    },
    {
      label: '请求与任务',
      component: 'SOFT_GROUP_BEGIN'
    },
    {
      field: 'request_timeout_ms',
      label: '普通请求超时(ms)',
      component: 'InputNumber',
      componentProps: {
        min: 1000,
        step: 1000
      }
    },
    {
      field: 'captcha_wait_timeout_ms',
      label: '验证码等待超时(ms)',
      component: 'InputNumber',
      componentProps: {
        min: 1000,
        step: 1000
      }
    },
    {
      field: 'community_task_timeout_ms',
      label: '社区任务超时(ms)',
      component: 'InputNumber',
      componentProps: {
        min: 1000,
        step: 1000
      }
    },
    {
      field: 'action_delay_ms',
      label: '动作间隔(ms)',
      bottomHelpMessage: '单个动作之间的等待时间，支持设为 0',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        step: 500
      }
    },
    {
      field: 'step_delay_ms',
      label: '步骤间隔(ms)',
      bottomHelpMessage: '任务步骤之间的等待时间，支持设为 0',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        step: 500
      }
    },
    {
      field: 'between_communities_ms',
      label: '社区间隔(ms)',
      bottomHelpMessage: '一键社区签到时两个社区之间的等待时间，支持设为 0',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        step: 500
      }
    },
    {
      label: '自动签到',
      component: 'SOFT_GROUP_BEGIN'
    },
    {
      field: 'auto_sign.enabled',
      label: '自动社区签到开关',
      bottomHelpMessage: '关闭后不再执行每日自动社区签到任务',
      component: 'Switch'
    },
    {
      field: 'auto_sign.cron',
      label: '自动签到时间',
      bottomHelpMessage: '支持 5/6/7 位 cron，默认每天 00:20 执行',
      component: 'EasyCron'
    },
    {
      field: 'auto_sign.notify_list.friend',
      label: '好友通知列表',
      bottomHelpMessage: '自动签到开始/完成时，向这些 QQ 发送私聊通知',
      component: 'GTags',
      componentProps: {
        placeholder: '请输入 QQ 号后回车'
      }
    },
    {
      field: 'auto_sign.notify_list.group',
      label: '群通知列表',
      bottomHelpMessage: '自动签到开始/完成时，向这些群发送推送',
      component: 'GSelectGroup',
      componentProps: {
        placeholder: '请选择要推送的群'
      }
    }
  ]
}

export function supportGuoba () {
  return {
    pluginInfo: {
      name: 'TaJiDuo-plugin',
      title: 'TaJiDuo-Plugin',
      author: ['@Entropy-Increase-Team'],
      authorLink: ['https://github.com/Entropy-Increase-Team'],
      link: 'https://github.com/Entropy-Increase-Team/TaJiDuo-plugin',
      isV3: true,
      isV2: false,
      showInMenu: true,
      description: 'Yunzai-Bot 的塔吉多社区插件',
      iconPath: path.join(pluginRoot, 'resources/img/ui/logo.png')
    },
    configInfo: {
      schemas: buildSchemas(),
      getConfigData () {
        const config = getMergedPluginConfig()
        const autoSign = isPlainObject(config.auto_sign) ? config.auto_sign : {}

        return {
          base_url: String(config.base_url || '').trim(),
          api_key: String(config.api_key || '').trim(),
          client_id: String(config.client_id || '').trim(),
          request_timeout_ms: normalizeNonNegativeInt(config.request_timeout_ms) ?? 15000,
          captcha_wait_timeout_ms: normalizeNonNegativeInt(config.captcha_wait_timeout_ms) ?? 300000,
          community_task_timeout_ms: normalizeNonNegativeInt(config.community_task_timeout_ms) ?? 300000,
          action_delay_ms: normalizeNonNegativeInt(config.action_delay_ms) ?? 3000,
          step_delay_ms: normalizeNonNegativeInt(config.step_delay_ms) ?? 8000,
          between_communities_ms: normalizeNonNegativeInt(config.between_communities_ms) ?? 15000,
          'auto_sign.enabled': autoSign.enabled !== false,
          'auto_sign.cron': String(autoSign.cron || '0 20 0 * * *').trim() || '0 20 0 * * *',
          'auto_sign.notify_list.friend': normalizeStringList(autoSign.notify_list?.friend),
          'auto_sign.notify_list.group': normalizeStringList(autoSign.notify_list?.group)
        }
      },
      setConfigData (data, { Result }) {
        try {
          const currentConfig = isPlainObject(Config.getConfig()) ? Config.getConfig() : {}
          const nextTajiduo = deepMerge(getMergedPluginConfig(), {})

          for (const [key, value] of Object.entries(data || {})) {
            if (NUMBER_FIELDS.has(key)) {
              setByPath(nextTajiduo, key, normalizeNonNegativeInt(value) ?? nextTajiduo[key])
              continue
            }

            setByPath(nextTajiduo, key, value)
          }

          nextTajiduo.base_url = String(nextTajiduo.base_url || '').trim()
          nextTajiduo.api_key = String(nextTajiduo.api_key || '').trim()
          nextTajiduo.client_id = String(nextTajiduo.client_id || '').trim()
          nextTajiduo.auto_sign = isPlainObject(nextTajiduo.auto_sign) ? nextTajiduo.auto_sign : {}
          nextTajiduo.auto_sign.cron = String(nextTajiduo.auto_sign.cron || '0 20 0 * * *').trim() || '0 20 0 * * *'
          nextTajiduo.auto_sign.notify_list = {
            friend: normalizeStringList(nextTajiduo.auto_sign.notify_list?.friend),
            group: normalizeStringList(nextTajiduo.auto_sign.notify_list?.group)
          }

          const ok = Config.setConfig({
            ...currentConfig,
            tajiduo: nextTajiduo
          })

          if (!ok) {
            return Result.error('TaJiDuo 配置保存失败，请检查文件权限')
          }

          return Result.ok({}, 'TaJiDuo 配置已保存')
        } catch (error) {
          logger.error('[TaJiDuo-plugin] Guoba 配置保存失败', error)
          return Result.error(`TaJiDuo 配置保存失败：${error?.message || error}`)
        }
      }
    }
  }
}
