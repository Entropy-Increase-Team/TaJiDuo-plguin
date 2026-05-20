import { PREFIX } from '../../utils/common.js'
import { BaseCommunityPlugin } from '../common/community.js'

export class huantaCommunity extends BaseCommunityPlugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]幻塔社区任务',
      dsc: '幻塔社区状态/等级/任务',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.huanta}社区状态$`,
          fnc: 'huantaCommunityState'
        },
        {
          reg: `^${PREFIX.huanta}社区等级$`,
          fnc: 'huantaCommunityLevel'
        },
        {
          reg: `^${PREFIX.huanta}(任务|社区任务列表)$`,
          fnc: 'huantaTasks'
        }
      ]
    })
  }

  async huantaCommunityState() {
    return this.communityState('huanta')
  }

  async huantaCommunityLevel() {
    return this.communityLevel('huanta')
  }

  async huantaTasks() {
    return this.tasks('huanta')
  }
}
