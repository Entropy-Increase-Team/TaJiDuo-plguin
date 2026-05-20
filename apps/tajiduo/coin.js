import { PREFIX } from '../../utils/common.js'
import { BaseShop } from './shared/shop.js'

export class tajiduoCoin extends BaseShop {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]塔塔币',
      dsc: '塔塔币余额查询',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}(币|塔塔币|塔吉多币)$`,
          fnc: 'coin'
        }
      ]
    })
  }
}
