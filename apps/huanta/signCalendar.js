import { PREFIX } from '../../utils/common.js'
import { BaseSignCalendarPlugin } from '../common/signCalendar.js'

export class huantaSignCalendar extends BaseSignCalendarPlugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]幻塔签到日历',
      dsc: '幻塔签到日历',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.huanta}(签到日历|签到一览|签到记录|签到历史)$`,
          fnc: 'huantaSignCalendar'
        }
      ]
    })
  }

  async huantaSignCalendar() {
    return this.signCalendar('huanta')
  }
}
