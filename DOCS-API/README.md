# API 文档索引

当前项目已经切到 `fwt` 登录态模式：

- `TaJiDuo` 只负责平台登录与账号会话
- 原始 `accessToken`、`refreshToken`、`tgdUid`、`deviceId` 落 PostgreSQL
- 第三方客户端只需要保存 `fwt`
- 首次登录建会话时由上游后端注入 `X-Platform-Id` 与 `X-Platform-User-Id`
- 默认启用全局 `apikey` 校验；除 `/health*` 和 `/_internal/api-keygen/*` 外都要携带有效 API Key
- 本文档默认统一通过请求头 `X-API-Key` + `X-Framework-Token` 传递鉴权信息
- 大多数业务接口都必须显式传 `fwt`；兑换码接口不要求 `fwt`

## 文档入口

- [TaJiDuo-API.md](./TaJiDuo-API.md)
  平台登录、账号管理、健康检查、游戏目录、跨社区总控。
- [Huanta-API.md](./Huanta-API.md)
  幻塔模块，包含游戏签到与社区任务。
- [YiHuan-API.md](./YiHuan-API.md)
  异环模块，现已开放游戏签到、补签、角色列表与社区任务。
- [HAR-API-Inventory.md](./HAR-API-Inventory.md)
  HAR 抓包接口盘点。

## 当前已实现接口

### 平台与公共层

| 接口 | 用途 |
| --- | --- |
| `GET /health` | 基础健康检查 |
| `GET /health/detailed` | 详细健康检查，含 PostgreSQL 与账号数 |
| `GET /_internal/api-keygen/health` | API Key 自举健康检查 |
| `POST /_internal/api-keygen/generate` | 用控制台秘钥生成 API Key |
| `POST /_internal/api-keygen/grant-admin` | 用控制台秘钥给 API Key 提权为管理员 |
| `GET /api/v1/games` | 已接入游戏列表 |
| `GET /api/v1/games/redeem-codes` | 兑换码列表 |
| `POST /api/v1/games/redeem-codes` | 新增兑换码，仅管理员 API Key |
| `GET /api/v1/games/shop/goods` | 商城商品列表 |
| `GET /api/v1/games/shop/goods/:goodsId` | 商城商品详情 |
| `GET /api/v1/games/shop/coin/state` | 塔吉多币状态 |
| `GET /api/v1/games/shop/coin/records/income` | 塔塔币明细-获取记录 |
| `GET /api/v1/games/shop/coin/records/consume` | 塔塔币明细-消耗记录 |
| `GET /api/v1/games/shop/game-roles` | 指定游戏角色列表 |
| `POST /api/v1/games/shop/exchange` | 商城商品兑换 |
| `POST /api/v1/login/tajiduo/captcha/send` | 发送短信验证码 |
| `POST /api/v1/login/tajiduo/captcha/check` | 校验短信验证码 |
| `POST /api/v1/login/tajiduo/session` | 登录并落库，返回 `username`、`tjdUid`、`fwt`、`platformId`、`platformUserId` |
| `POST /api/v1/login/tajiduo/refresh` | 用已保存账号刷新登录态 |
| `GET /api/v1/login/tajiduo/profile` | 当前 tjd 账号个人资料 |
| `GET /api/v1/login/tajiduo/accounts` | 账号列表 |
| `POST /api/v1/login/tajiduo/accounts/primary` | 切换主账号 |
| `DELETE /api/v1/login/tajiduo/accounts/:fwt` | 退出登录 / 删除账号 |
| `POST /api/v1/games/community/sign/all` | 提交跨社区批量任务 |
| `GET /api/v1/games/community/sign/tasks/:taskId` | 查询跨社区批量任务状态 |

### 幻塔模块

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/games/huanta/roles` | 拉取角色列表 |
| `GET /api/v1/games/huanta/sign/state` | 游戏签到状态 |
| `GET /api/v1/games/huanta/sign/rewards` | 游戏签到奖励表 |
| `GET /api/v1/games/huanta/sign/resign-info` | 游戏补签信息 |
| `POST /api/v1/games/huanta/sign/game` | 单角色游戏签到 |
| `POST /api/v1/games/huanta/sign/resign` | 单角色游戏补签 |
| `POST /api/v1/games/huanta/sign/all` | 幻塔聚合签到 |
| `POST /api/v1/games/huanta/sign/app` | 社区签到单步 |
| `POST /api/v1/games/huanta/community/sign/all` | 提交幻塔社区 5 步任务 |
| `GET /api/v1/games/huanta/community/sign/tasks/:taskId` | 查询幻塔社区任务状态 |
| `GET /api/v1/games/huanta/community/sign/state` | 社区签到状态 |
| `GET /api/v1/games/huanta/community/tasks` | 社区任务列表 |
| `GET /api/v1/games/huanta/community/exp/level` | 社区等级 |
| `GET /api/v1/games/huanta/community/exp/records` | 社区经验流水 |

### 异环模块

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/games/yihuan/roles` | 拉取角色列表 |
| `GET /api/v1/games/yihuan/sign/state` | 游戏签到状态 |
| `GET /api/v1/games/yihuan/sign/rewards` | 游戏签到奖励表 |
| `GET /api/v1/games/yihuan/sign/resign-info` | 游戏补签信息 |
| `POST /api/v1/games/yihuan/sign/game` | 单角色游戏签到 |
| `POST /api/v1/games/yihuan/sign/resign` | 单角色游戏补签 |
| `POST /api/v1/games/yihuan/sign/app` | 社区签到单步 |
| `POST /api/v1/games/yihuan/community/sign/all` | 提交异环社区 5 步任务 |
| `GET /api/v1/games/yihuan/community/sign/tasks/:taskId` | 查询异环社区任务状态 |
| `GET /api/v1/games/yihuan/community/sign/state` | 社区签到状态 |
| `GET /api/v1/games/yihuan/community/tasks` | 社区任务列表 |
| `GET /api/v1/games/yihuan/community/exp/level` | 社区等级 |
| `GET /api/v1/games/yihuan/community/exp/records` | 社区经验流水 |

## 关键边界

- `TaJiDuo` 文档不承载具体 `gameId`
- 幻塔游戏层固定 `gameId = 1256`
- 异环主游戏参考 `gameId = 1289`
- 幻塔社区固定 `communityId = 1`
- 异环社区固定 `communityId = 2`
