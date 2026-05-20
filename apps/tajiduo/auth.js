import { PREFIX } from '../../utils/common.js'
import { BaseLogin } from './shared/login.js'

export class tajiduoAuth extends BaseLogin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]登录',
      dsc: '塔吉多账号登录/绑定',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}(验证码|发送验证码|手机登录|手机绑定)(?:\\s+.*)?$`,
          fnc: 'sendCaptcha'
        },
        {
          reg: `^${PREFIX.tajiduo}(登录|登陆|绑定)(?:\\s+.*)?$`,
          fnc: 'login'
        }
      ]
    })
  }
}
