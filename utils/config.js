import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { pluginRoot } from '../model/path.js'

const userConfigDir = path.join(pluginRoot, 'config', 'config')
const userConfigPath = path.join(userConfigDir, 'tajiduo.yaml')
const defaultConfigPath = path.join(pluginRoot, 'config', 'tajiduo_default.yaml')

// 确保配置目录和默认配置存在
fs.mkdirSync(userConfigDir, { recursive: true })
if (!fs.existsSync(userConfigPath) && fs.existsSync(defaultConfigPath)) {
  try {
    fs.copyFileSync(defaultConfigPath, userConfigPath)
    logger.info('[TaJiDuo-plugin] 已自动创建 tajiduo.yaml')
  } catch (error) {
    logger.error('[TaJiDuo-plugin] 自动创建 tajiduo.yaml 失败', error)
  }
}

class Config {
  constructor() {
    this.cache = { config: null, defaultConfig: null }
    this.fileMaps = { config: userConfigPath, defaultConfig: defaultConfigPath }
    this.watchFiles()
  }

  loadYaml(filePath) {
    if (!fs.existsSync(filePath)) return {}
    try {
      return YAML.parse(fs.readFileSync(filePath, 'utf8')) || {}
    } catch (error) {
      logger.error(`[TaJiDuo-plugin] 读取配置失败：${path.basename(filePath)}`, error)
      return {}
    }
  }

  watchFiles() {
    Object.entries(this.fileMaps).forEach(([key, filePath]) => {
      if (fs.existsSync(filePath)) {
        fs.watchFile(filePath, { interval: 1000 }, () => this.cache[key] = null)
      }
    })
  }

  getConfig() {
    return this.cache.config ??= this.loadYaml(this.fileMaps.config)
  }

  getDefaultConfig() {
    return this.cache.defaultConfig ??= this.loadYaml(this.fileMaps.defaultConfig)
  }

  get(group, key) {
    const config = this.getConfig()
    return config?.[group]?.[key] ?? this.getDefaultConfig()?.[group]?.[key]
  }

  setConfig(data) {
    try {
      fs.writeFileSync(this.fileMaps.config, YAML.stringify(data), 'utf8')
      this.cache.config = data
      return true
    } catch (error) {
      logger.error('[TaJiDuo-plugin] 写入配置失败', error)
      return false
    }
  }
}

export default new Config()