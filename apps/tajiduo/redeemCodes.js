import { PREFIX } from '../../utils/common.js'
import { BaseShop } from './shared/shop.js'

export class tajiduoRedeemCodes extends BaseShop {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]兑换码',
      dsc: '塔吉多兑换码查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}(兑换码|礼包码)(?:\\s*.*)?$`,
          fnc: 'redeemCodes'
        }
      ]
    })
  }
}
