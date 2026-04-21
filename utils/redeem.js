const REDEEM_GAMES = Object.freeze({
  huanta: {
    code: 'huanta',
    name: '幻塔',
    aliases: ['huanta', '幻塔']
  },
  yihuan: {
    code: 'yihuan',
    name: '异环',
    aliases: ['yihuan', '异环']
  }
})

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000

const pad2 = (value) => String(value ?? '').padStart(2, '0')

function normalizeRedeemGameCode (value = '') {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''

  for (const item of Object.values(REDEEM_GAMES)) {
    if (item.aliases.includes(text) || item.aliases.includes(String(value || '').trim())) {
      return item.code
    }
  }

  return ''
}

function getRedeemGameName (value = '') {
  const code = normalizeRedeemGameCode(value) || String(value || '').trim().toLowerCase()
  return REDEEM_GAMES[code]?.name || String(value || '').trim() || '未知游戏'
}

function formatUtc8DateTime (value = '', fallback = '未设置') {
  const text = String(value || '').trim()
  if (!text) return fallback

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return text
  }

  const local = new Date(date.getTime() + UTC8_OFFSET_MS)
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())} ${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}:${pad2(local.getUTCSeconds())} (UTC+8)`
}

function parseUtc8DateTime (value = '') {
  const text = String(value || '').trim()
  const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})[- T](\d{2}):(\d{2}):(\d{2})$/)
  if (!matched) {
    return null
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = matched
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 ||
    second < 0 || second > 59
  ) {
    return null
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second))
  const verified = new Date(utcDate.getTime() + UTC8_OFFSET_MS)

  if (
    verified.getUTCFullYear() !== year ||
    verified.getUTCMonth() + 1 !== month ||
    verified.getUTCDate() !== day ||
    verified.getUTCHours() !== hour ||
    verified.getUTCMinutes() !== minute ||
    verified.getUTCSeconds() !== second
  ) {
    return null
  }

  return {
    text,
    iso: `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}+08:00`,
    display: `${yearText}-${monthText}-${dayText} ${hourText}:${minuteText}:${secondText} (UTC+8)`,
    timestamp: utcDate.getTime()
  }
}

export {
  REDEEM_GAMES,
  formatUtc8DateTime,
  getRedeemGameName,
  normalizeRedeemGameCode,
  parseUtc8DateTime
}
