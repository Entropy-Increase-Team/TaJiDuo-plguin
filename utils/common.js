function maskValue (value = '', head = 6, tail = 4) {
  const text = String(value || '').trim()
  if (!text) return '未保存'
  if (text.length <= head + tail) return text
  return `${text.slice(0, head)}...${text.slice(-tail)}`
}

function shortenText (value = '', maxLength = 1500) {
  const text = String(value || '')
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n...（已截断）`
}

function formatJsonPreview (value, maxLength = 1500) {
  if (value === undefined) return 'undefined'

  try {
    return shortenText(JSON.stringify(value, null, 2), maxLength)
  } catch (error) {
    return shortenText(String(value || ''), maxLength)
  }
}

function normalizePositiveInt (value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return undefined
  return Math.round(num)
}

function normalizeNonNegativeInt (value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return undefined
  return Math.round(num)
}

function joinLines (lines = []) {
  return lines
    .filter((line) => line !== undefined && line !== null && String(line) !== '')
    .join('\n')
}

function pickFirstNonEmpty (...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value
    }
  }

  return undefined
}

export {
  formatJsonPreview,
  joinLines,
  maskValue,
  normalizeNonNegativeInt,
  normalizePositiveInt,
  pickFirstNonEmpty,
  shortenText
}
