import setting from '../../utils/setting.js'
import { PREFIX } from '../../utils/common.js'
import { BaseSignPlugin, getTaskCron } from '../common/sign.js'

export class tajiduoSign extends BaseSignPlugin {
  constructor() {
    const signConfig = setting.getConfig('sign') || {}
    super({
      name: '[TaJiDuo-plugin]塔吉多聚合签到',
      dsc: '塔吉多聚合签到',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}签到$`,
          fnc: 'tajiduoSign'
        }
      ]
    })

    this.setting = signConfig
    this.task = {
      cron: getTaskCron(this.setting.auto_sign_cron, '30 0 * * *', '塔吉多自动签到'),
      name: 'TaJiDuo-plugin 自动签到',
      fnc: () => this.autoSignTask()
    }
  }
}
