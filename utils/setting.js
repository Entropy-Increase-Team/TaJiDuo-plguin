import YAML from 'yaml'
import chokidar from 'chokidar'
import fs from 'node:fs'

const _path = process.cwd().replace(/\\/g, '/')
// help/message 作为可选覆盖文件，不随启动自动复制；需要自定义时由用户手动从 defSet 复制到 config。
const CONFIG_SKIP_COPY = ['help', 'message']

function deepMerge(base, override) {
  if (override == null || typeof override !== 'object') return base ?? override
  if (Array.isArray(override)) return override
  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) }
  for (const key of Object.keys(override)) {
    const value = override[key]
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = deepMerge(out[key], value)
    } else {
      out[key] = value
    }
  }
  return out
}

class Setting {
  constructor() {
    this.defPath = `${_path}/plugins/TaJiDuo-plugin/defSet/`
    this.defSet = {}
    this.configPath = `${_path}/plugins/TaJiDuo-plugin/config/`
    this.config = {}
    this.dataPath = `${_path}/plugins/TaJiDuo-plugin/data/`
    this.data = {}
    this.watcher = { config: {}, defSet: {}, data: {} }

    this.initCfg()
  }

  initCfg() {
    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true })
    }
    const files = fs.readdirSync(this.defPath).filter((file) => file.endsWith('.yaml'))
    for (const file of files) {
      const app = file.replace('.yaml', '')
      if (CONFIG_SKIP_COPY.includes(app)) continue
      if (!fs.existsSync(`${this.configPath}${file}`)) {
        fs.copyFileSync(`${this.defPath}${file}`, `${this.configPath}${file}`)
      }
      this.watch(`${this.configPath}${file}`, app, 'config')
    }
  }

  merge() {
    const sets = {}
    const appsConfig = fs.readdirSync(this.defPath).filter((file) => file.endsWith('.yaml'))
    for (const appConfig of appsConfig) {
      const filename = appConfig.replace(/.yaml/g, '').trim()
      sets[filename] = this.getConfig(filename)
    }
    return sets
  }

  analysis(config) {
    for (const key of Object.keys(config)) {
      this.setConfig(key, config[key])
    }
  }

  getdefSet(app) {
    return this.getYaml(app, 'defSet')
  }

  getConfig(app) {
    if (CONFIG_SKIP_COPY.includes(app)) {
      const def = this.getdefSet(app) || {}
      const configFile = `${this.configPath}${app}.yaml`
      if (!fs.existsSync(configFile)) return def
      const cfg = this.getYaml(app, 'config') || {}
      return deepMerge(def, cfg)
    }
    return { ...this.getdefSet(app), ...this.getYaml(app, 'config') }
  }

  getData(app) {
    return this.getYaml(app, 'data')
  }

  setConfig(app, data) {
    return this.setYaml(app, 'config', { ...this.getdefSet(app), ...data })
  }

  setData(app, data) {
    return this.setYaml(app, 'data', data)
  }

  setYaml(app, type, data) {
    const file = this.getFilePath(app, type)
    try {
      if (type === 'data' && !fs.existsSync(this.dataPath)) fs.mkdirSync(this.dataPath, { recursive: true })
      if (type === 'config' && !fs.existsSync(this.configPath)) fs.mkdirSync(this.configPath, { recursive: true })
      fs.writeFileSync(file, YAML.stringify(data), 'utf8')
      if (this[type]?.[app]) delete this[type][app]
      return true
    } catch (error) {
      logger.error(`[TaJiDuo-plugin][${app}] 写入失败 ${error}`)
      return false
    }
  }

  getYaml(app, type) {
    if (type === 'config' && CONFIG_SKIP_COPY.includes(app)) {
      const file = `${this.configPath}${app}.yaml`
      if (!fs.existsSync(file)) return {}
      if (this[type][app]) return this[type][app]
      try {
        this[type][app] = YAML.parse(fs.readFileSync(file, 'utf8')) || {}
      } catch (error) {
        logger.error(`[TaJiDuo-plugin][${app}] 格式错误 ${error}`)
        return {}
      }
      this.watch(file, app, type)
      return this[type][app]
    }

    const file = this.getFilePath(app, type)
    if (type === 'data' && !fs.existsSync(file)) return {}
    if (this[type][app]) return this[type][app]

    try {
      this[type][app] = YAML.parse(fs.readFileSync(file, 'utf8')) || {}
    } catch (error) {
      logger.error(`[TaJiDuo-plugin][${app}] 格式错误 ${error}`)
      return type === 'data' ? {} : false
    }
    this.watch(file, app, type)
    return this[type][app]
  }

  getFilePath(app, type) {
    if (type === 'defSet') return `${this.defPath}${app}.yaml`
    if (type === 'data') return `${this.dataPath}${app}.yaml`
    try {
      if (!CONFIG_SKIP_COPY.includes(app) && !fs.existsSync(`${this.configPath}${app}.yaml`)) {
        fs.copyFileSync(`${this.defPath}${app}.yaml`, `${this.configPath}${app}.yaml`)
      }
    } catch (error) {
      logger.error(`TaJiDuo-plugin 缺失默认文件[${app}]${error}`)
    }
    return `${this.configPath}${app}.yaml`
  }

  watch(file, app, type = 'defSet') {
    if (this.watcher[type][app]) return

    const watcher = chokidar.watch(file)
    watcher.on('change', () => {
      delete this[type][app]
      logger.mark(`[TaJiDuo-plugin][修改配置文件][${type}][${app}]`)
      if (this[`change_${app}`]) {
        this[`change_${app}`]()
      }
    })
    this.watcher[type][app] = watcher
  }
}

export default new Setting()
