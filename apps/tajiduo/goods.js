import { PREFIX } from '../../utils/common.js'
import { BaseShop } from './shared/shop.js'

export class tajiduoGoods extends BaseShop {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]商城',
      dsc: '塔吉多商城商品查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}(商城|商店)(?:\\s*.*)?$`,
          fnc: 'goods'
        }
      ]
    })
  }
}
