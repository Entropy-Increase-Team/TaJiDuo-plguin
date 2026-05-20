import TaJiDuoUser from '../../model/tajiduoUser.js'
import {
  compactLine,
  getMessage,
  getUnbindMessage,
  normalizeRole,
  pickRole,
  PREFIX,
  summarizeApiError
} from '../../utils/common.js'

function dataBody(res = {}) {
  return res.data?.data ?? res.data ?? {}
}

function clampPercent(progress = 0, total = 0) {
  const current = Number(progress ?? 0)
  const target = Number(total ?? 0)
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
}

function renderRealtimeData(data = {}) {
  const stamina = data.staminaValue ?? data.stamina_value ?? 0
  const staminaMax = data.staminaMaxValue ?? data.stamina_max_value ?? 0
  const cityStamina = data.citystaminaValue ?? data.cityStaminaValue ?? data.city_stamina_value ?? 0
  const cityStaminaMax = data.citystaminaMaxValue ?? data.cityStaminaMaxValue ?? data.city_stamina_max_value ?? 0
  const dayValue = data.dayvalue ?? data.dayValue ?? 0
  const weekRemain = data.weekcopiesremainCnt ?? data.weekCopiesRemainCnt ?? 0

  return {
    stats: [
      {
        label: '本性像素',
        value: stamina,
        max: staminaMax,
        percent: clampPercent(stamina, staminaMax)
      },
      {
        label: '都市活力',
        value: cityStamina,
        max: cityStaminaMax,
        percent: clampPercent(cityStamina, cityStaminaMax)
      },
      {
        label: '活跃度',
        value: dayValue,
        max: 100,
        percent: clampPercent(dayValue, 100)
      },
      {
        label: '周本次数',
        value: weekRemain,
        max: 3,
        percent: clampPercent(weekRemain, 3)
      }
    ]
  }
}

export class realtime extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环实时信息',
      dsc: '异环体力/活力查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.yihuan}(体力|活力|[Mm][Rr])$`,
          fnc: 'yihuanRealtime'
        }
      ]
    })
  }

  async getCurrentUser() {
    const userId = this.e.at || this.e.user_id
    const tjdUser = new TaJiDuoUser(userId)
    if (!await tjdUser.getUser()) {
      await this.reply(getUnbindMessage())
      return null
    }
    return tjdUser
  }

  async resolveFirstRole(tjdUser) {
    const rolesRes = await tjdUser.tjdReq.getData('game_roles', { gameCode: 'yihuan' })
    const roles = (rolesRes?.data?.roles || []).map(normalizeRole).filter((role) => role.roleId)
    return pickRole(roles) || null
  }

  async yihuanRealtime() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const role = await this.resolveFirstRole(tjdUser)
    if (!role) {
      await this.reply(getMessage('game.roles_empty', { game: '异环' }))
      return true
    }

    const res = await tjdUser.tjdReq.getData('yihuan_role_home', { roleId: role.roleId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = dataBody(res)
    const uid = data.roleid || data.roleId || role.roleId
    const realtimeData = renderRealtimeData(data)
    const lines = [`异环实时信息：${data.rolename || role.roleName || uid}`]
    lines.push(compactLine('等级', data.lev ?? role.level))
    for (const item of realtimeData.stats) {
      lines.push(`${item.label}：${item.value}/${item.max}`)
    }
    await this.reply(lines.join('\n'))
    return true
  }
}
