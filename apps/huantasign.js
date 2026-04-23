import plugin from '../../../lib/plugins/plugin.js'
import TaJiDuoApi from '../model/api.js'
import { clearUserSession, getUserSession } from '../model/store.js'
import {
  AUTH_EXPIRED_MESSAGE,
  LOGIN_COMMAND_EXAMPLE,
  buildReloginReply,
  getErrorMessage,
  isAuthExpiredError
} from '../utils/auth.js'
import { joinLines, normalizePositiveInt, pickFirstNonEmpty } from '../utils/common.js'
import { buildCommandReg, formatCommand } from '../utils/command.js'

function isPlainObject (value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSearchText (value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function normalizeRoleList (data = {}) {
  const roles = Array.isArray(data?.roles) ? data.roles.filter((item) => isPlainObject(item)) : []
  const bindRole = String(data?.bindRole || '').trim()
  const seenRoleIds = new Set()
  const list = []

  for (const item of roles) {
    const roleId = String(item?.roleId || '').trim()
    if (!roleId || seenRoleIds.has(roleId)) {
      continue
    }

    seenRoleIds.add(roleId)
    list.push({
      ...item,
      roleId,
      isBound: bindRole && bindRole === roleId
    })
  }

  if (bindRole && !seenRoleIds.has(bindRole)) {
    list.unshift({
      roleId: bindRole,
      isBound: true
    })
  }

  return list
}

function buildRoleLabel (role = {}, index = 0) {
  const parts = [`${index + 1}. ${role?.roleName || role?.roleId || '未命名角色'}`]

  if (role?.lev !== undefined) {
    parts.push(`等级 ${role.lev}`)
  }

  if (role?.serverName) {
    parts.push(`区服 ${role.serverName}`)
  }

  if (role?.isBound) {
    parts.push('绑定角色')
  }

  return parts.join(' | ')
}

function buildRoleSelectionReply (rolesData = {}, query = '') {
  const roles = normalizeRoleList(rolesData)
  const commandPrefix = formatCommand('签到', 'huanta')

  if (roles.length === 0) {
    return joinLines([
      '当前账号下未查询到幻塔角色',
      '请确认该塔吉多账号已绑定幻塔角色后再试'
    ])
  }

  const lines = [
    query
      ? `未找到匹配的幻塔角色：${query}`
      : '当前账号下存在多个幻塔角色，请指定要签到的角色'
  ]

  roles.forEach((role, index) => {
    lines.push(buildRoleLabel(role, index))
    lines.push(`roleId：${role.roleId}`)
  })

  lines.push('')
  lines.push(`示例：${commandPrefix} 1`)

  if (roles[0]?.roleId) {
    lines.push(`或：${commandPrefix} ${roles[0].roleId}`)
  }

  lines.push(`也支持：${commandPrefix} 角色名`)
  return joinLines(lines)
}

function buildRoleDetailLines (role = {}, selectionSource = '') {
  const lines = []

  if (selectionSource === 'bound') {
    lines.push('角色选择：已自动使用绑定角色')
  } else if (selectionSource === 'single') {
    lines.push('角色选择：当前仅有一个角色，已自动使用')
  }

  lines.push(`角色：${role?.roleName || role?.roleId || '未返回'}`)

  if (role?.serverName) {
    lines.push(`区服：${role.serverName}`)
  }

  if (role?.lev !== undefined) {
    lines.push(`等级：${role.lev}`)
  }

  if (role?.roleId) {
    lines.push(`角色ID：${role.roleId}`)
  }

  return lines
}

function buildStateLines (state = {}) {
  const lines = []
  const month = Number(state?.month)
  const day = Number(state?.day)

  if (Number.isFinite(month) && Number.isFinite(day)) {
    lines.push(`日期：${month}月${day}日`)
  }

  if (state?.todaySign !== undefined) {
    lines.push(`今日状态：${state.todaySign ? '已签到' : '未签到'}`)
  }

  if (state?.days !== undefined) {
    lines.push(`累计签到：${state.days}`)
  }

  if (state?.reSignCnt !== undefined) {
    lines.push(`补签次数：${state.reSignCnt}`)
  }

  return lines
}

function normalizeUpstreamMessage (value = '') {
  const text = String(value || '').trim()
  if (!text) {
    return ''
  }

  if (['ok', 'success'].includes(text.toLowerCase())) {
    return ''
  }

  return text
}

function buildAlreadySignedReply (state = {}, role = null, selectionSource = '', fallbackMessage = '') {
  return joinLines([
    '塔吉多幻塔签到',
    ...(role ? buildRoleDetailLines(role, selectionSource) : []),
    ...buildStateLines(state),
    `结果：${pickFirstNonEmpty(fallbackMessage, '今天已经签到过了')}`
  ])
}

function buildHuantaSignReply (role = {}, selectionSource = '', data = {}, state = {}) {
  const upstream = isPlainObject(data?.upstream) ? data.upstream : {}
  const success = data?.success !== false && upstream?.success !== false
  const resultMessage = pickFirstNonEmpty(
    normalizeUpstreamMessage(data?.reward),
    normalizeUpstreamMessage(data?.message),
    normalizeUpstreamMessage(upstream?.message),
    success ? '签到成功' : '签到失败'
  )

  return joinLines([
    '塔吉多幻塔签到完成',
    ...buildRoleDetailLines(role, selectionSource),
    ...buildStateLines(state),
    `结果：${success ? '成功' : '失败'}${resultMessage ? ` | ${resultMessage}` : ''}`
  ])
}

function resolveRoleSelection (rolesData = {}, query = '') {
  const roles = normalizeRoleList(rolesData)
  const keyword = String(query || '').trim()

  if (!keyword) {
    const boundRole = roles.find((item) => item?.isBound)
    if (boundRole) {
      return {
        role: boundRole,
        roles,
        selectionSource: 'bound'
      }
    }

    if (roles.length === 1) {
      return {
        role: roles[0],
        roles,
        selectionSource: 'single'
      }
    }

    return {
      role: null,
      roles,
      selectionSource: ''
    }
  }

  const directRole = roles.find((item) => String(item?.roleId || '') === keyword)
  if (directRole) {
    return {
      role: directRole,
      roles,
      selectionSource: 'roleId'
    }
  }

  const selectedIndex = normalizePositiveInt(keyword)
  if (selectedIndex && roles[selectedIndex - 1]) {
    return {
      role: roles[selectedIndex - 1],
      roles,
      selectionSource: 'index'
    }
  }

  const normalizedKeyword = normalizeSearchText(keyword)

  const exactRole = roles.find((item) => {
    const roleName = normalizeSearchText(item?.roleName)
    const serverName = normalizeSearchText(item?.serverName)
    return roleName === normalizedKeyword || serverName === normalizedKeyword
  })

  if (exactRole) {
    return {
      role: exactRole,
      roles,
      selectionSource: 'name'
    }
  }

  const fuzzyMatches = roles.filter((item) => {
    const roleName = normalizeSearchText(item?.roleName)
    const serverName = normalizeSearchText(item?.serverName)
    return roleName.includes(normalizedKeyword) || serverName.includes(normalizedKeyword)
  })

  if (fuzzyMatches.length === 1) {
    return {
      role: fuzzyMatches[0],
      roles,
      selectionSource: 'name'
    }
  }

  return {
    role: null,
    roles,
    selectionSource: ''
  }
}

function parseHuantaSignArgs (message = '') {
  const text = String(message || '').trim()
  const patterns = [
    /^#?(?:幻塔|[Tt][Oo][Ff]|[Hh][Tt])\s*(?:签到|游戏签到)\s*(.*)$/u,
    /^#?(?:塔吉多|[Tt][Jj][Dd])\s*(?:幻塔签到|幻塔游戏签到)\s*(.*)$/u
  ]

  for (const pattern of patterns) {
    const matched = text.match(pattern)
    if (matched) {
      return String(matched[1] || '').trim()
    }
  }

  return ''
}

function isAlreadySignedError (error) {
  return /已签|签到过/.test(getErrorMessage(error))
}

export class HuantaSign extends plugin {
  constructor () {
    super({
      name: '[TaJiDuo-plugin] 幻塔签到',
      dsc: 'TaJiDuo 幻塔游戏签到',
      event: 'message',
      priority: 96,
      rule: [
        { reg: buildCommandReg('(?:幻塔签到|幻塔游戏签到)(?:\\s+.*)?'), fnc: 'signHuantaGame' },
        { reg: buildCommandReg('(?:签到|游戏签到)(?:\\s+.*)?', 'huanta'), fnc: 'signHuantaGame' }
      ]
    })

    this.api = new TaJiDuoApi()
  }

  async signHuantaGame () {
    const roleQuery = parseHuantaSignArgs(this.e.msg)

    try {
      const fwt = await this.getStoredFwt()
      const stateBefore = await this.getHuantaSignState(fwt, { silent: true })

      if (stateBefore?.todaySign === true) {
        await this.reply(buildAlreadySignedReply(stateBefore))
        return true
      }

      const rolesData = await this.api.huantaRoles({ fwt })
      const selection = resolveRoleSelection(rolesData, roleQuery)

      if (!selection?.role?.roleId) {
        await this.reply(buildRoleSelectionReply(rolesData, roleQuery))
        return true
      }

      await this.reply(joinLines([
        '塔吉多幻塔签到中，请稍候...',
        ...buildRoleDetailLines(selection.role, selection.selectionSource)
      ]))

      let signData
      try {
        signData = await this.api.huantaSignGame({
          fwt,
          roleId: String(selection.role.roleId)
        })
      } catch (error) {
        if (isAlreadySignedError(error)) {
          await this.reply(buildAlreadySignedReply(
            {
              ...(stateBefore || {}),
              todaySign: true
            },
            selection.role,
            selection.selectionSource,
            getErrorMessage(error)
          ))
          return true
        }

        throw error
      }

      const stateAfter = await this.getHuantaSignState(fwt, { silent: true })
      await this.reply(buildHuantaSignReply(
        selection.role,
        selection.selectionSource,
        signData,
        stateAfter || stateBefore || {}
      ))
    } catch (error) {
      return this.replyFailure('塔吉多幻塔签到失败', error)
    }

    return true
  }

  async getHuantaSignState (fwt = '', options = {}) {
    try {
      return await this.api.huantaSignState({ fwt })
    } catch (error) {
      if (options?.silent && !isAuthExpiredError(error)) {
        logger.warn(`[TaJiDuo-plugin] 幻塔签到状态查询失败，已忽略：${getErrorMessage(error)}`)
        return null
      }

      throw error
    }
  }

  async replyFailure (title = '', error) {
    if (isAuthExpiredError(error)) {
      await this.clearCurrentUserSession()
      await this.reply(buildReloginReply(title, getErrorMessage(error) || AUTH_EXPIRED_MESSAGE))
      return true
    }

    await this.reply(`${title}：${getErrorMessage(error)}`)
    return true
  }

  getSessionIdentity () {
    return {
      selfId: this.e.self_id || 'bot',
      userId: this.e.user_id
    }
  }

  async getStoredFwt () {
    const { selfId, userId } = this.getSessionIdentity()
    const session = await getUserSession(selfId, userId)
    const fwt = String(session?.fwt || '').trim()

    if (!fwt) {
      throw new Error(`请先发送 ${LOGIN_COMMAND_EXAMPLE} 完成登录`)
    }

    return fwt
  }

  async clearCurrentUserSession () {
    const { selfId, userId } = this.getSessionIdentity()
    await clearUserSession(selfId, userId)
  }
}
