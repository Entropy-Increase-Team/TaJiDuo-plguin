import { PREFIX } from '../../utils/common.js'
import { BaseSignPlugin } from '../common/sign.js'

export class huantaSign extends BaseSignPlugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]幻塔签到',
      dsc: '幻塔签到/签到状态/补签',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.huanta}签到$`,
          fnc: 'huantaSign'
        },
        {
          reg: `^${PREFIX.huanta}签到状态$`,
          fnc: 'huantaSignState'
        },
        {
          reg: `^${PREFIX.huanta}补签(?:\\s*\\d+)?$`,
          fnc: 'huantaResign'
        }
      ]
    })
  }

  async huantaSign() {
    return this.sign('huanta')
  }

  async huantaSignState() {
    return this.signState('huanta')
  }

  async huantaResign() {
    return this.resign('huanta')
  }
}
