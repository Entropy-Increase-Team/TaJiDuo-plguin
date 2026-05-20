import TaJiDuoUser, { addOrUpdateAccount } from '../../model/tajiduoUser.js'
import {
  compactLine,
  formatTime,
  getMessage,
  getUnbindMessage,
  PREFIX,
  summarizeApiError
} from '../../utils/common.js'

export class tajiduoProfile extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]塔吉多资料',
      dsc: '塔吉多账号资料查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}(资料|信息|个人资料|账号资料)$`,
          fnc: 'profile'
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
    tjdUser.ownerId = userId
    return tjdUser
  }

  async profile() {
    const tjdUser = await this.getCurrentUser()
    if (!tjdUser) return true

    const res = await tjdUser.tjdReq.getData('profile')
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = res.data || {}
    await addOrUpdateAccount(tjdUser.ownerId || this.e.user_id, {
      ...tjdUser.account,
      nickname: data.nickname,
      tjd_uid: data.uid || tjdUser.account?.tjd_uid,
      avatar: data.avatar,
      introduce: data.introduce
    })

    const lines = [
      getMessage('profile.title'),
      compactLine('昵称', data.nickname),
      compactLine('UID', data.uid),
      compactLine('简介', data.introduce),
      compactLine('绑定时间', formatTime(tjdUser.account?.bind_time))
    ]
    await this.reply(lines.join('\n'))
    return true
  }
}
