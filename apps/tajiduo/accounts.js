import { PREFIX } from '../../utils/common.js'
import { BaseLogin } from './shared/login.js'

export class tajiduoAccounts extends BaseLogin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]账号管理',
      dsc: '塔吉多账号列表/切换/删除/刷新',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}(账号|登录|登陆|绑定)列表$`,
          fnc: 'accountList'
        },
        {
          reg: `^${PREFIX.tajiduo}切换(账号|登录|登陆|绑定)\\s*(\\d+)$`,
          fnc: 'switchAccount'
        },
        {
          reg: `^${PREFIX.tajiduo}删除(账号|登录|登陆|绑定)\\s*(\\d+)$`,
          fnc: 'deleteAccount'
        },
        {
          reg: `^${PREFIX.tajiduo}刷新(?:账号|登录|登陆|绑定)?$`,
          fnc: 'refreshAccount'
        }
      ]
    })
  }
}
