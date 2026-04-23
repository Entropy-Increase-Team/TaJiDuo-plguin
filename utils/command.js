const PREFIX_GROUPS = Object.freeze({
  general: {
    display: 'tjd',
    pattern: '#?(?:塔吉多|[Tt][Jj][Dd])'
  },
  huanta: {
    display: 'tof',
    pattern: '#?(?:幻塔|[Tt][Oo][Ff]|[Hh][Tt])'
  },
  yihuan: {
    display: 'nte',
    pattern: '#?(?:异环|[Nn][Tt][Ee]|[Yy][Hh])'
  }
})

const DEFAULT_PREFIX_KEY = 'general'

function uniqueValues (items = []) {
  return [...new Set(items)]
}

function normalizePrefixKeys (prefixKeys = DEFAULT_PREFIX_KEY) {
  const list = Array.isArray(prefixKeys) ? prefixKeys : [prefixKeys]
  const keys = uniqueValues(
    list
      .map((item) => String(item || '').trim())
      .filter((item) => PREFIX_GROUPS[item])
  )

  return keys.length > 0 ? keys : [DEFAULT_PREFIX_KEY]
}

function getCommandPrefixPattern (prefixKeys = DEFAULT_PREFIX_KEY) {
  return `(?:${normalizePrefixKeys(prefixKeys)
    .map((key) => PREFIX_GROUPS[key].pattern)
    .join('|')})`
}

function buildCommandReg (commandPattern = '', prefixKeys = DEFAULT_PREFIX_KEY) {
  return `^${getCommandPrefixPattern(prefixKeys)}\\s*${commandPattern}$`
}

function extractCommandArgs (message = '', commandPattern = '', prefixKeys = DEFAULT_PREFIX_KEY) {
  const text = String(message || '').trim()
  const matched = text.match(new RegExp(`^${getCommandPrefixPattern(prefixKeys)}\\s*${commandPattern}\\s*(.*)$`))
  return String(matched?.[1] || '').trim()
}

function formatCommand (command = '', prefixKey = DEFAULT_PREFIX_KEY) {
  const prefix = PREFIX_GROUPS[prefixKey]?.display || PREFIX_GROUPS[DEFAULT_PREFIX_KEY].display
  return `${prefix}${String(command || '').trim()}`
}

function formatCommandList (command = '', prefixKeys = DEFAULT_PREFIX_KEY) {
  return normalizePrefixKeys(prefixKeys).map((key) => formatCommand(command, key)).join(' / ')
}

export {
  DEFAULT_PREFIX_KEY,
  PREFIX_GROUPS,
  buildCommandReg,
  extractCommandArgs,
  formatCommand,
  formatCommandList
}
