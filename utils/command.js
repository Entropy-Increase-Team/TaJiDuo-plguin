const COMMAND_PREFIXES = ['#塔吉多', '#tjd']
const DEFAULT_COMMAND_PREFIX = COMMAND_PREFIXES[0]
const CASE_INSENSITIVE_TJD_PATTERN = '#[Tt][Jj][Dd]'

function escapeRegExp (value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const COMMAND_PREFIX_PATTERN = `(?:${escapeRegExp(COMMAND_PREFIXES[0])}|${CASE_INSENSITIVE_TJD_PATTERN})`

function buildCommandReg (commandPattern = '') {
  return `^${COMMAND_PREFIX_PATTERN}\\s*${commandPattern}$`
}

function extractCommandArgs (message = '', commandPattern = '') {
  const text = String(message || '').trim()
  const matched = text.match(new RegExp(`^${COMMAND_PREFIX_PATTERN}\\s*${commandPattern}\\s*(.*)$`))
  return String(matched?.[1] || '').trim()
}

function formatCommand (command = '', prefix = DEFAULT_COMMAND_PREFIX) {
  return `${String(prefix || DEFAULT_COMMAND_PREFIX).trim()}${String(command || '').trim()}`
}

function formatCommandList (command = '') {
  return COMMAND_PREFIXES.map((prefix) => formatCommand(command, prefix)).join(' / ')
}

export {
  COMMAND_PREFIXES,
  DEFAULT_COMMAND_PREFIX,
  buildCommandReg,
  extractCommandArgs,
  formatCommand,
  formatCommandList
}
