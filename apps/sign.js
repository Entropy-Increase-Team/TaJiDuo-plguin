import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import TaJiDuoApi from '../model/api.js'
import { clearUserSession, getUserSession, listUserSessions } from '../model/store.js'
import Config from '../utils/config.js'
import { buildCommandReg, formatCommand } from '../utils/command.js'
import { joinLines, normalizeNonNegativeInt, pickFirstNonEmpty } from '../utils/common.js'

const PLATFORM_ALIAS = '(?:TaJiDuo|tajiduo|TAJIDUO|塔吉多)'

const ALL_COMMUNITY_SIGN_REG = buildCommandReg(`${PLATFORM_ALIAS}社区签到`)
const HUANTA_COMMUNITY_SIGN_REG = buildCommandReg(`${PLATFORM_ALIAS}幻塔社区签到`)
const YIHUAN_COMMUNITY_SIGN_REG = buildCommandReg(`${PLATFORM_ALIAS}异环社区签到`)
const ALL_COMMUNITY_QUERY_REG = buildCommandReg(`${PLATFORM_ALIAS}社区查询`)
const HUANTA_COMMUNITY_QUERY_REG = buildCommandReg(`${PLATFORM_ALIAS}幻塔社区查询`)
const YIHUAN_COMMUNITY_QUERY_REG = buildCommandReg(`${PLATFORM_ALIAS}异环社区查询`)
const DEFAULT_TASK_GID = 2
const COMMUNITY_TASK_POLL_INTERVAL_MS = 2000
const AUTH_EXPIRED_MESSAGE = '当前 fwt 已失效，请重新登录'
const ACTIVE_COMMUNITY_TASK_KEYS = new Set([
  'signin_exp',
  'browse_post_exp',
  'send_post_exp',
  'send_comment_exp',
  'like_post_exp'
])
const COMMUNITY_GAME_CONFIG = Object.freeze({
  huanta: {
    key: 'huanta',
    name: '幻塔',
    signTitle: '塔吉多幻塔社区签到',
    queryTitle: '塔吉多幻塔社区查询',
    queryForwardTitle: '塔吉多幻塔社区查询结果',
    submitTaskMethod: 'huantaCommunitySignAll',
    fetchTaskMethod: 'huantaCommunitySignTask',
    fetchLevelMethod: 'huantaCommunityExpLevel',
    fetchTasksMethod: 'huantaCommunityTasks'
  },
  yihuan: {
    key: 'yihuan',
    name: '异环',
    signTitle: '塔吉多异环社区签到',
    queryTitle: '塔吉多异环社区查询',
    queryForwardTitle: '塔吉多异环社区查询结果',
    submitTaskMethod: 'yihuanCommunitySignAll',
    fetchTaskMethod: 'yihuanCommunitySignTask',
    fetchLevelMethod: 'yihuanCommunityExpLevel',
    fetchTasksMethod: 'yihuanCommunityTasks'
  }
})
const ALL_COMMUNITY_META = Object.freeze({
  signTitle: '塔吉多社区签到',
  queryTitle: '塔吉多社区查询',
  queryForwardTitle: '塔吉多社区查询结果'
})

function isPlainObject (value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function getCommunityGameConfig (gameKey = '') {
  return COMMUNITY_GAME_CONFIG[String(gameKey || '').trim()]
}

function getConfiguredDelay (key, fallback) {
  return normalizeNonNegativeInt(Config.get('tajiduo', key)) ?? fallback
}

function buildSingleCommunityPayload (fwt = '') {
  return {
    fwt,
    actionDelayMs: getConfiguredDelay('action_delay_ms', 3000),
    stepDelayMs: getConfiguredDelay('step_delay_ms', 8000)
  }
}

function buildAllCommunityPayload (fwt = '') {
  return {
    ...buildSingleCommunityPayload(fwt),
    betweenCommunitiesMs: getConfiguredDelay('between_communities_ms', 15000)
  }
}

function sleep (ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
}

function getTaskStatus (payload = {}) {
  return String(payload?.status || '').trim().toLowerCase()
}

function getTaskId (payload = {}) {
  return String(payload?.taskId || '').trim()
}

function isTaskFinished (payload = {}) {
  return getTaskStatus(payload) === 'finished' || payload?.completed === true
}

function isTaskFailed (payload = {}) {
  return getTaskStatus(payload) === 'failed'
}

function extractTaskErrorMessage (payload = {}) {
  return String(
    pickFirstNonEmpty(
      payload?.error?.message,
      payload?.error,
      payload?.message,
      payload?.result?.item?.message,
      payload?.result?.batch?.message
    ) || '任务执行失败'
  ).trim()
}

function isAuthExpiredError (error) {
  const message = String(error?.message || '').trim()
  return error?.isAuthError === true ||
    Number(error?.responseStatus) === 401 ||
    Number(error?.responseCode) === 401 ||
    message.includes(AUTH_EXPIRED_MESSAGE)
}

function buildReloginReply (title = '', message = AUTH_EXPIRED_MESSAGE) {
  return joinLines([
    title,
    `结果：${message}`,
    `请重新发送 ${formatCommand('塔吉多登录 13800138000')}`
  ])
}

function getErrorMessage (error) {
  return String(error?.message || error || '').trim()
}

function pickLevelValue (payload = {}, ...keys) {
  const sources = [
    payload,
    payload?.data,
    payload?.upstream?.data,
    payload?.upstream
  ].filter((item) => isPlainObject(item))

  for (const key of keys) {
    const value = pickFirstNonEmpty(...sources.map((item) => item?.[key]))
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

function toFiniteNumber (value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function getTaskProgressTarget (task = {}) {
  const limitTimes = toFiniteNumber(task?.limitTimes)
  if (limitTimes !== undefined && limitTimes > 0) {
    return limitTimes
  }

  const targetTimes = toFiniteNumber(task?.targetTimes)
  if (targetTimes !== undefined && targetTimes > 0) {
    return targetTimes
  }

  return undefined
}

function getTaskCompleteTimes (task = {}) {
  return toFiniteNumber(task?.completeTimes) ?? 0
}

function isTaskCompleted (task = {}) {
  const target = getTaskProgressTarget(task)
  if (target === undefined) {
    return false
  }

  return getTaskCompleteTimes(task) >= target
}

function getCommunityTaskGroups (data = {}) {
  const groups = Array.isArray(data?.groups) ? data.groups : []

  return groups
    .map((group) => ({
      key: String(group?.key || '').trim(),
      items: Array.isArray(group?.items) ? group.items.filter((item) => isPlainObject(item)) : []
    }))
    .filter((group) => group.items.length > 0)
}

function flattenCommunityTaskItems (data = {}) {
  return getCommunityTaskGroups(data).flatMap((group) => group.items.map((item) => ({
    ...item,
    groupKey: group.key
  })))
}

function formatTaskProgress (task = {}) {
  const completeTimes = getTaskCompleteTimes(task)
  const target = getTaskProgressTarget(task)

  if (target === undefined) {
    return `${completeTimes}`
  }

  return `${completeTimes}/${target}`
}

function formatPendingTask (task = {}) {
  const taskTitle = task?.title || task?.taskKey || '未知任务'
  return `${taskTitle} ${formatTaskProgress(task)}`
}

function buildTaskSnapshotLines (title = '', tasks = []) {
  const items = Array.isArray(tasks) ? tasks : []
  if (items.length === 0) return []

  const lines = [`${title}：`]

  items.forEach((task, index) => {
    const taskTitle = task?.title || task?.taskKey || `任务${index + 1}`
    const completeTimes = Number(task?.completeTimes)
    const limitTimes = Number(task?.limitTimes)
    const isCompleted = Number.isFinite(limitTimes) && limitTimes > 0 && Number.isFinite(completeTimes) && completeTimes >= limitTimes
    const parts = []

    if (isCompleted) {
      parts.push('已完成')
    } else if (task?.completeTimes !== undefined || task?.limitTimes !== undefined) {
      parts.push(`${task?.completeTimes ?? 0}/${task?.limitTimes ?? '?'}`)
    }

    if (task?.remaining !== undefined) {
      parts.push(`剩余 ${task.remaining}`)
    }

    lines.push(`${index + 1}. ${taskTitle}${parts.length > 0 ? `：${parts.join(' | ')}` : ''}`)
  })

  return lines
}

function summarizeResultObject (value = {}) {
  if (!isPlainObject(value)) return ''

  const parts = []

  if (value.success !== undefined) {
    parts.push(value.success ? '成功' : '失败')
  }

  if (value.message) {
    parts.push(String(value.message))
  }

  if (value.reward && String(value.reward) !== String(value.message || '')) {
    parts.push(`奖励：${value.reward}`)
  }

  return parts.join(' | ')
}

function findCommunityItemByGameCode (data = {}, gameCode = '') {
  const code = String(gameCode || '').trim()
  if (!code) return null

  if (isPlainObject(data?.[code])) {
    return data[code]
  }

  const items = Array.isArray(data?.items) ? data.items : []
  return items.find((item) => String(item?.gameCode || '').trim() === code) || null
}

function buildNestedCommunityLines (data = {}) {
  const sections = [
    ['幻塔社区', findCommunityItemByGameCode(data, 'huanta')],
    ['异环社区', findCommunityItemByGameCode(data, 'yihuan')]
  ]

  const lines = []

  for (const [title, section] of sections) {
    if (!isPlainObject(section)) continue

    const summary = summarizeResultObject(section)
    if (summary) {
      lines.push(`${title}：${summary}`)
    } else {
      lines.push(`${title}：已返回结果`)
    }

    const before = buildTaskSnapshotLines(`${title}执行前任务`, section?.tasksBefore)
    if (before.length > 0) {
      lines.push(...before)
    }

    const after = buildTaskSnapshotLines(`${title}执行后任务`, section?.tasksAfter)
    if (after.length > 0) {
      lines.push(...after)
    }

    lines.push('')
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines
}

function buildCommunityReply (title = '', data = {}) {
  const lines = [
    title,
    summarizeResultObject(data) ? `结果：${summarizeResultObject(data)}` : ''
  ]

  const before = buildTaskSnapshotLines('执行前任务', data?.tasksBefore)
  if (before.length > 0) {
    lines.push('', ...before)
  }

  const after = buildTaskSnapshotLines('执行后任务', data?.tasksAfter)
  if (after.length > 0) {
    lines.push('', ...after)
  }

  const nested = buildNestedCommunityLines(data)
  if (nested.length > 0) {
    lines.push('', ...nested)
  }

  return joinLines(lines)
}

function buildCommunityLevelLines (data = {}) {
  const level = pickLevelValue(data, 'level', 'expLevel')
  const currentExp = pickLevelValue(data, 'currentExp', 'curExp', 'exp', 'totalExp')
  const levelExp = pickLevelValue(data, 'levelExp')
  const nextLevel = pickLevelValue(data, 'nextLevel')
  const nextLevelExp = pickLevelValue(data, 'nextLevelExp', 'nextExp', 'needExp', 'requiredExp', 'remainExp')
  const todayExp = pickLevelValue(data, 'todayExp')
  const message = String(
    pickFirstNonEmpty(
      data?.message,
      data?.msg,
      data?.upstream?.message,
      data?.upstream?.msg
    ) || ''
  ).trim()

  const lines = []

  if (level !== undefined) {
    lines.push(`等级：${level}`)
  }

  if (currentExp !== undefined) {
    lines.push(`当前经验：${currentExp}`)
  }

  if (levelExp !== undefined) {
    lines.push(`本级经验：${levelExp}`)
  }

  if (nextLevel !== undefined) {
    lines.push(`下一级：${nextLevel}`)
  }

  if (nextLevelExp !== undefined) {
    lines.push(`下级所需经验：${nextLevelExp}`)
  }

  if (todayExp !== undefined) {
    lines.push(`今日获得经验：${todayExp}`)
  }

  if (lines.length === 0 && message) {
    lines.push(`结果：${message}`)
  }

  if (lines.length === 0) {
    lines.push('已返回等级数据')
  }

  return lines
}

function buildCommunityTaskOverviewLines (data = {}) {
  const items = flattenCommunityTaskItems(data)
  if (items.length === 0) {
    return ['任务信息：暂无数据']
  }

  const completedCount = items.filter((task) => isTaskCompleted(task)).length
  const activeItems = items.filter((task) => ACTIVE_COMMUNITY_TASK_KEYS.has(String(task?.taskKey || '').trim()))
  const activeCompletedCount = activeItems.filter((task) => isTaskCompleted(task)).length
  const pendingItems = items.filter((task) => !isTaskCompleted(task))
  const lines = []

  if (activeItems.length > 0) {
    lines.push(`主动任务：${activeCompletedCount}/${activeItems.length}`)
  }

  lines.push(`全部任务：${completedCount}/${items.length}`)

  if (pendingItems.length === 0) {
    lines.push('任务状态：全部完成')
  } else {
    lines.push(`未完成：${pendingItems.map((task) => formatPendingTask(task)).join('、')}`)
  }

  return lines
}

function buildCommunityTaskDetailLines (title = '', data = {}) {
  const items = flattenCommunityTaskItems(data)
  const lines = [title]

  if (items.length === 0) {
    lines.push('暂无任务数据')
    return lines
  }

  items.forEach((task, index) => {
    const taskTitle = task?.title || task?.taskKey || `任务${index + 1}`
    const parts = [
      formatTaskProgress(task),
      isTaskCompleted(task) ? '已完成' : '未完成'
    ]

    if (task?.exp !== undefined) {
      parts.push(`经验 ${task.exp}`)
    }

    const coin = toFiniteNumber(task?.coin)
    if (coin !== undefined && coin > 0) {
      parts.push(`金币 ${coin}`)
    }

    lines.push(`${index + 1}. ${taskTitle}：${parts.join(' | ')}`)
  })

  return lines
}

function buildCommunityQueryMessages (communityName = '', levelData, tasksData, errors = {}) {
  const queryTitle = `塔吉多${communityName}社区查询`
  const taskTitle = `塔吉多${communityName}社区任务`
  const summaryLines = [queryTitle]
  const levelLines = levelData ? buildCommunityLevelLines(levelData) : []

  if (levelLines.length > 0) {
    summaryLines.push(...levelLines)
  } else if (errors.level) {
    summaryLines.push(`等级信息：获取失败 | ${errors.level}`)
  } else {
    summaryLines.push('等级信息：暂无数据')
  }

  summaryLines.push('')

  if (tasksData) {
    summaryLines.push(...buildCommunityTaskOverviewLines(tasksData))
  } else if (errors.tasks) {
    summaryLines.push(`任务信息：获取失败 | ${errors.tasks}`)
  } else {
    summaryLines.push('任务信息：暂无数据')
  }

  const messages = [joinLines(summaryLines)]

  if (tasksData) {
    messages.push(joinLines(buildCommunityTaskDetailLines(taskTitle, tasksData)))
  } else if (errors.tasks) {
    messages.push(joinLines([
      taskTitle,
      `获取失败：${errors.tasks}`
    ]))
  }

  return messages
}

function extractSingleCommunityTaskResult (payload = {}) {
  if (isPlainObject(payload?.result?.item)) {
    return payload.result.item
  }

  if (isPlainObject(payload?.item)) {
    return payload.item
  }

  return isPlainObject(payload) ? payload : {}
}

function extractBatchCommunityTaskResult (payload = {}) {
  if (isPlainObject(payload?.result?.batch)) {
    return payload.result.batch
  }

  if (isPlainObject(payload?.batch)) {
    return payload.batch
  }

  return isPlainObject(payload) ? payload : {}
}

function describeAutoSignTarget (item = {}) {
  const parts = []

  if (item?.session?.username) {
    parts.push(`昵称=${item.session.username}`)
  }

  if (item?.session?.tgdUid) {
    parts.push(`塔吉多UID=${item.session.tgdUid}`)
  }

  if (item?.userId !== undefined) {
    parts.push(`用户=${item.userId}`)
  }

  return parts.join(' | ') || '未命名账号'
}

export class TaJiDuoCommunitySign extends plugin {
  constructor (e) {
    super({
      name: '[TaJiDuo-plugin] 社区签到',
      dsc: 'TaJiDuo 社区签到',
      event: 'message',
      priority: 100,
      rule: [
        { reg: ALL_COMMUNITY_SIGN_REG, fnc: 'signAllCommunities' },
        { reg: HUANTA_COMMUNITY_SIGN_REG, fnc: 'signHuantaCommunity' },
        { reg: YIHUAN_COMMUNITY_SIGN_REG, fnc: 'signYihuanCommunity' },
        { reg: ALL_COMMUNITY_QUERY_REG, fnc: 'queryAllCommunities' },
        { reg: HUANTA_COMMUNITY_QUERY_REG, fnc: 'queryHuantaCommunity' },
        { reg: YIHUAN_COMMUNITY_QUERY_REG, fnc: 'queryYihuanCommunity' }
      ]
    })

    this.e = e
    this.api = new TaJiDuoApi()
    this.task = [
      {
        name: '[TaJiDuo-plugin] 每日社区签到',
        cron: '0 20 0 * * *',
        fnc: () => this.autoDailyCommunitySign()
      }
    ]
  }

  async getStoredFwt () {
    const session = await getUserSession(this.e.self_id || 'bot', this.e.user_id)
    const fwt = String(session?.fwt || '').trim()

    if (!fwt) {
      throw new Error('请先发送 #塔吉多登录 <手机号> 完成登录')
    }

    return fwt
  }

  async clearCurrentUserSession () {
    await clearUserSession(this.e.self_id || 'bot', this.e.user_id)
  }

  async replyFailure (title = '', error) {
    if (isAuthExpiredError(error)) {
      await this.clearCurrentUserSession()
      await this.reply(buildReloginReply(title, error.message || AUTH_EXPIRED_MESSAGE))
      return true
    }

    await this.reply(`${title}：${error.message || error}`)
    return true
  }

  getSingleCommunityApiMethods (gameKey = '') {
    const config = getCommunityGameConfig(gameKey)
    if (!config) {
      throw new Error(`未知社区配置：${gameKey}`)
    }

    return {
      config,
      submitTask: this.api[config.submitTaskMethod].bind(this.api),
      fetchTask: this.api[config.fetchTaskMethod].bind(this.api),
      fetchLevel: this.api[config.fetchLevelMethod].bind(this.api),
      fetchTasks: this.api[config.fetchTasksMethod].bind(this.api)
    }
  }

  async executeSingleCommunitySign (gameKey = '') {
    const { config } = this.getSingleCommunityApiMethods(gameKey)

    try {
      const fwt = await this.getStoredFwt()
      await this.reply(`${config.signTitle}开始执行，请稍候...`)
      const { data } = await this.runSingleCommunitySign(gameKey, fwt)
      await this.reply(buildCommunityReply(`${config.signTitle}执行完成`, data))
      return true
    } catch (error) {
      return this.replyFailure(`${config.signTitle}失败`, error)
    }
  }

  async signAllCommunities () {
    try {
      const fwt = await this.getStoredFwt()
      await this.reply(`${ALL_COMMUNITY_META.signTitle}开始执行，请稍候...`)
      const { data } = await this.runAllCommunitySign(fwt)
      await this.reply(buildCommunityReply(`${ALL_COMMUNITY_META.signTitle}执行完成`, data))
      return true
    } catch (error) {
      return this.replyFailure(`${ALL_COMMUNITY_META.signTitle}失败`, error)
    }
  }

  async signHuantaCommunity () {
    return this.executeSingleCommunitySign('huanta')
  }

  async signYihuanCommunity () {
    return this.executeSingleCommunitySign('yihuan')
  }

  getTaskWaitTimeoutMs (type = 'single', payload = {}) {
    if (type === 'all') {
      return Math.max(
        this.api.getCommunityTaskTimeoutMs(),
        this.api.estimateAllCommunitiesTimeoutMs(payload)
      )
    }

    return Math.max(
      this.api.getCommunityTaskTimeoutMs(),
      this.api.estimateSingleCommunityTimeoutMs(payload)
    )
  }

  async waitForTaskCompletion (options = {}) {
    const {
      submitTask,
      fetchTask,
      payload = {},
      timeoutMs = this.api.getCommunityTaskTimeoutMs(),
      extractResult = (data) => data
    } = options

    const submitData = await submitTask(payload)
    const taskId = getTaskId(submitData)

    if (!taskId) {
      return {
        taskId: '',
        submitData,
        statusData: submitData,
        finalData: extractResult(submitData) || submitData
      }
    }

    if (isTaskFinished(submitData)) {
      return {
        taskId,
        submitData,
        statusData: submitData,
        finalData: extractResult(submitData) || submitData
      }
    }

    const startedAt = Date.now()
    let latestData = submitData

    while (Date.now() - startedAt <= timeoutMs) {
      await sleep(COMMUNITY_TASK_POLL_INTERVAL_MS)
      latestData = await fetchTask(taskId, { fwt: payload?.fwt })

      if (isTaskFailed(latestData)) {
        throw new Error(extractTaskErrorMessage(latestData))
      }

      if (isTaskFinished(latestData)) {
        return {
          taskId,
          submitData,
          statusData: latestData,
          finalData: extractResult(latestData) || latestData
        }
      }
    }

    throw new Error(`等待任务完成超时：${taskId}`)
  }

  async runSingleCommunitySign (gameKey = '', fwt = '') {
    const { submitTask, fetchTask } = this.getSingleCommunityApiMethods(gameKey)
    const payload = buildSingleCommunityPayload(fwt)
    const result = await this.waitForTaskCompletion({
      submitTask,
      fetchTask,
      payload,
      timeoutMs: this.getTaskWaitTimeoutMs('single', payload),
      extractResult: extractSingleCommunityTaskResult
    })

    return {
      payload,
      data: result.finalData,
      taskId: result.taskId
    }
  }

  async runAllCommunitySign (fwt = '') {
    const payload = buildAllCommunityPayload(fwt)
    const result = await this.waitForTaskCompletion({
      submitTask: this.api.communitySignAll.bind(this.api),
      fetchTask: this.api.communitySignTask.bind(this.api),
      payload,
      timeoutMs: this.getTaskWaitTimeoutMs('all', payload),
      extractResult: extractBatchCommunityTaskResult
    })

    return {
      payload,
      data: result.finalData,
      taskId: result.taskId
    }
  }

  async fetchCommunityQueryData (options = {}) {
    const {
      fetchLevel,
      fetchTasks,
      fwt = ''
    } = options

    const taskPayload = {
      fwt,
      gid: DEFAULT_TASK_GID
    }

    const [levelResult, tasksResult] = await Promise.allSettled([
      fetchLevel({ fwt }),
      fetchTasks(taskPayload)
    ])

    const levelError = levelResult.status === 'rejected' ? levelResult.reason : null
    const tasksError = tasksResult.status === 'rejected' ? tasksResult.reason : null

    return {
      levelData: levelResult.status === 'fulfilled' ? levelResult.value : null,
      tasksData: tasksResult.status === 'fulfilled' ? tasksResult.value : null,
      errors: {
        level: levelError ? getErrorMessage(levelError) : '',
        tasks: tasksError ? getErrorMessage(tasksError) : ''
      },
      authError: isAuthExpiredError(levelError) ? levelError : (isAuthExpiredError(tasksError) ? tasksError : null)
    }
  }

  async replyQueryForward (title = '', messages = []) {
    const forward = await common.makeForwardMsg(this.e, messages, title)
    await this.reply(forward)
  }

  async fetchSingleCommunityQueryData (gameKey = '', fwt = '') {
    const { fetchLevel, fetchTasks } = this.getSingleCommunityApiMethods(gameKey)
    return this.fetchCommunityQueryData({ fetchLevel, fetchTasks, fwt })
  }

  ensureQueryResultAvailable (result = {}) {
    if (result.authError) {
      throw result.authError
    }

    if (!result.levelData && !result.tasksData) {
      throw new Error(result.errors.level || result.errors.tasks || '未获取到社区数据')
    }
  }

  async executeSingleCommunityQuery (gameKey = '') {
    const { config } = this.getSingleCommunityApiMethods(gameKey)

    try {
      const fwt = await this.getStoredFwt()
      await this.reply(`${config.queryTitle}开始执行，请稍候...`)
      const result = await this.fetchSingleCommunityQueryData(gameKey, fwt)
      this.ensureQueryResultAvailable(result)
      await this.replyQueryForward(
        config.queryForwardTitle,
        buildCommunityQueryMessages(config.name, result.levelData, result.tasksData, result.errors)
      )
      return true
    } catch (error) {
      return this.replyFailure(`${config.queryTitle}失败`, error)
    }
  }

  async queryHuantaCommunity () {
    return this.executeSingleCommunityQuery('huanta')
  }

  async queryYihuanCommunity () {
    return this.executeSingleCommunityQuery('yihuan')
  }

  async queryAllCommunities () {
    try {
      const fwt = await this.getStoredFwt()
      await this.reply(`${ALL_COMMUNITY_META.queryTitle}开始执行，请稍候...`)
      const gameKeys = Object.keys(COMMUNITY_GAME_CONFIG)
      const results = await Promise.all(gameKeys.map((gameKey) => this.fetchSingleCommunityQueryData(gameKey, fwt)))
      const resultMap = Object.fromEntries(gameKeys.map((gameKey, index) => [gameKey, results[index]]))
      const authError = results.find((result) => result?.authError)?.authError

      if (authError) {
        throw authError
      }

      const hasAnyData = results.some((result) => result?.levelData || result?.tasksData)
      if (!hasAnyData) {
        throw new Error(results
          .flatMap((result) => [result?.errors?.level, result?.errors?.tasks])
          .filter(Boolean)
          .join(' | ') || '未获取到社区数据')
      }

      const messages = gameKeys.flatMap((gameKey) => {
        const config = getCommunityGameConfig(gameKey)
        const result = resultMap[gameKey] || {}
        return buildCommunityQueryMessages(config?.name || gameKey, result.levelData, result.tasksData, result.errors)
      })

      await this.replyQueryForward(ALL_COMMUNITY_META.queryForwardTitle, messages)
      return true
    } catch (error) {
      return this.replyFailure(`${ALL_COMMUNITY_META.queryTitle}失败`, error)
    }
  }

  async autoDailyCommunitySign () {
    const sessions = await listUserSessions()

    if (sessions.length === 0) {
      logger.info('[TaJiDuo-plugin] 每日 00:20 自动社区签到跳过：当前没有已保存账号')
      return true
    }

    logger.info(`[TaJiDuo-plugin] 每日 00:20 自动社区签到开始，共 ${sessions.length} 个账号`)

    let successCount = 0

    for (const item of sessions) {
      const targetText = describeAutoSignTarget(item)

      try {
        const { data } = await this.runAllCommunitySign(item.session.fwt)
        successCount += 1
        logger.info(`[TaJiDuo-plugin] 自动社区签到成功：${targetText} | ${summarizeResultObject(data) || '执行完成'}`)
      } catch (error) {
        if (isAuthExpiredError(error)) {
          await clearUserSession(item.selfId, item.userId)
          logger.warn(`[TaJiDuo-plugin] 自动社区签到登录失效，已清理本地会话：${targetText} | ${error.message || error}`)
          continue
        }

        logger.error(`[TaJiDuo-plugin] 自动社区签到失败：${targetText} | ${error.message || error}`)
      }
    }

    logger.info(`[TaJiDuo-plugin] 每日 00:20 自动社区签到完成：${successCount}/${sessions.length}`)
    return true
  }
}
