const maskValue = (value = '', head = 6, tail = 4) => {
  const text = String(value ?? '').trim()
  if (!text) return '未保存'
  return text.length <= head + tail ? text : `${text.slice(0, head)}...${text.slice(-tail)}`
}

const shortenText = (value = '', maxLength = 1500) => {
  const text = String(value ?? '')
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n...（已截断）`
}

const formatJsonPreview = (value, maxLength = 1500) => {
  if (value === undefined) return 'undefined'
  try {
    return shortenText(JSON.stringify(value, null, 2), maxLength)
  } catch {
    return shortenText(String(value ?? ''), maxLength)
  }
}

const normalizePositiveInt = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? Math.round(num) : undefined
}

const normalizeNonNegativeInt = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : undefined
}

const joinLines = (lines = []) => 
  lines.filter(line => line?.toString() !== '').join('\n')

const pickFirstNonEmpty = (...values) => 
  values.find(v => v != null && String(v).trim() !== '')

export {
  formatJsonPreview,
  joinLines,
  maskValue,
  normalizeNonNegativeInt,
  normalizePositiveInt,
  pickFirstNonEmpty,
  shortenText
}