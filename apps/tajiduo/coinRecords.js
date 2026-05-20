import { PREFIX } from '../../utils/common.js'
import { BaseShop } from './shared/shop.js'

export class tajiduoCoinRecords extends BaseShop {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]塔塔币记录',
      dsc: '塔塔币收入/消耗记录',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.tajiduo}(收入|获取记录)$`,
          fnc: 'incomeRecords'
        },
        {
          reg: `^${PREFIX.tajiduo}(消耗|消耗记录)$`,
          fnc: 'consumeRecords'
        }
      ]
    })
  }
}
