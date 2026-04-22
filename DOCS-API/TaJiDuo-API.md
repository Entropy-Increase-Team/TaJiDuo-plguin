# TaJiDuo API

`TaJiDuo` 现在等同于平台登录层与公共接口层。

它只负责：

- 短信验证码
- 登录建会话
- 登录态刷新
- 账号列表 / 主账号切换 / 删除账号
- 商城列表 / 商品详情 / 角色查询 / 商品兑换
- 健康检查
- 游戏目录
- 跨社区总控

它不负责具体游戏 `gameId` 和游戏业务细节。

## 核心原则

- 服务端把原始 `accessToken`、`refreshToken`、`tgdUid`、`deviceId` 保存到 PostgreSQL
- 客户端只需要持有 `fwt`
- 业务接口与平台账号管理接口统一使用 `fwt`
- 终端客户端登录时只需要提交手机号、验证码、`deviceId`
- 调用 TaJiDuo API 的上游后端必须在建会话时注入 `X-Platform-Id` 与 `X-Platform-User-Id`
- 账号列表、切主账号、删除账号都按 `platformId + platformUserId` 隔离
- 本文档默认统一通过请求头 `X-Framework-Token` 传递 `fwt`
- 默认启用全局 `apikey` 校验；除 `/health*` 和 `/_internal/api-keygen/*` 外都必须携带有效 API Key
- 不再兼容把原始 `accessToken / refreshToken / tgdUid / deviceId` 当作业务接口入口
- 大多数用户态接口都必须显式传有效 `fwt`

## 响应格式

除少数上游透传失败场景外，当前接口统一返回：

```json
{
  "code": 0,
  "message": "成功",
  "data": {}
}
```

字段说明：

- `code`: 业务码，`0` 表示成功
- `message`: 响应说明
- `data`: 业务数据

常见错误响应示例：

```json
{
  "code": 400,
  "message": "缺少 fwt"
}
```

```json
{
  "code": 401,
  "message": "当前 fwt 已失效，请重新登录"
}
```

```json
{
  "code": 401,
  "message": "缺少 apiKey"
}
```

## 平台接口

| 接口 | 用途 |
| --- | --- |
| `POST /api/v1/login/tajiduo/captcha/send` | 发送短信验证码 |
| `POST /api/v1/login/tajiduo/captcha/check` | 校验短信验证码 |
| `GET /_internal/api-keygen/health` | API Key 自举健康检查 |
| `POST /_internal/api-keygen/generate` | 用控制台秘钥生成 API Key |
| `POST /_internal/api-keygen/grant-admin` | 用控制台秘钥给已有 API Key 提权为管理员 |
| `GET /api/v1/games/redeem-codes` | 兑换码列表 |
| `POST /api/v1/games/redeem-codes` | 新增兑换码，仅管理员 API Key |
| `GET /api/v1/games/shop/goods` | 商城商品列表 |
| `GET /api/v1/games/shop/goods/:goodsId` | 商城商品详情 |
| `GET /api/v1/games/shop/coin/state` | 塔吉多币状态 |
| `GET /api/v1/games/shop/coin/records/income` | 塔塔币明细-获取记录 |
| `GET /api/v1/games/shop/coin/records/consume` | 塔塔币明细-消耗记录 |
| `GET /api/v1/games/shop/game-roles` | 指定游戏角色列表 |
| `POST /api/v1/games/shop/exchange` | 商城商品兑换 |
| `POST /api/v1/login/tajiduo/session` | 登录并保存账号，返回 `username`、展示用 `tjdUid`、`fwt`、`platformId`、`platformUserId` |
| `POST /api/v1/login/tajiduo/refresh` | 刷新已保存账号 |
| `GET /api/v1/login/tajiduo/profile` | 查询当前 tjd 账号个人资料 |
| `GET /api/v1/login/tajiduo/accounts` | 查看账号列表 |
| `POST /api/v1/login/tajiduo/accounts/primary` | 切主账号 |
| `DELETE /api/v1/login/tajiduo/accounts/:fwt` | 删除账号 |

## API Key

当前服务默认启用 API Key：

1. `/health` 和 `/health/detailed` 默认免鉴权
2. `/_internal/api-keygen/*` 默认从 API Key 中间件放行，但会在接口内部校验控制台秘钥
3. 其他接口都需要携带有效 API Key
4. 本文档默认统一通过请求头 `X-API-Key` 传递 API Key
5. 接口实现也兼容 `Authorization: Bearer <api-key>`，但本文档默认不再展示
6. 动态生成的 API Key 固定格式是 `tjd-` 加 16 位随机大小写字母数字
7. 动态生成的 API Key 元数据持久化在 PostgreSQL
8. 生成型 API Key 支持 `is_admin` 管理员标记，并可后续提权
9. `POST /api/v1/games/redeem-codes` 仅管理员 API Key 可用

示例：

```http
X-API-Key: your-api-key
```

控制台秘钥示例：

```http
X-Console-Key: your-console-key
```

### `GET /_internal/api-keygen/health`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "status": "healthy"
  }
}
```

### `POST /_internal/api-keygen/generate`

说明：

- 这个接口不要求 API Key
- 但必须携带有效控制台秘钥
- 支持 `X-Console-Key` 或 `Authorization: Bearer <console-key>`
- 会返回一个可直接用于后续业务调用的 API Key

JSON 请求体：

```json
{
  "name": "telegram-bot",
  "expires_in_hours": 720,
  "is_admin": true
}
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "api_key": "tjd-A1b2C3d4E5f6G7h8",
    "key_prefix": "tjd-",
    "name": "telegram-bot",
    "issued_at": "2026-04-21T12:30:00Z",
    "expires_at": "2026-05-21T12:30:00Z",
    "is_admin": true,
    "console_key_mode": "postgres_short_token"
  }
}
```

说明：

- `is_admin` 可选，默认 `false`
- `is_admin = true` 时会直接生成管理员 API Key

### `POST /_internal/api-keygen/grant-admin`

说明：

- 这个接口不要求 API Key
- 但必须携带有效控制台秘钥
- 支持 `X-Console-Key` 或 `Authorization: Bearer <console-key>`
- 用于把一个已有生成型 API Key 提权成管理员

JSON 请求体：

```json
{
  "api_key": "tjd-A1b2C3d4E5f6G7h8"
}
```

## 兑换码接口

说明：

- 兑换码接口只要求有效 API Key
- 不要求 `fwt`
- `POST /api/v1/games/redeem-codes` 必须使用管理员 API Key
- `code` 按传入内容原样保存，大小写敏感，`ABC123` 和 `abc123` 视为两个不同兑换码

### `GET /api/v1/games/redeem-codes`

查询参数：

- `gameCode`：可选，例如 `huanta`
- `includeExpired`：可选，`true` 时返回已过期兑换码

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "items": [
      {
        "id": 1,
        "gameCode": "huanta",
        "gameName": "幻塔",
        "code": "HT2026SPRING",
        "description": "2026 春季礼包",
        "exchangeRewards": "墨晶*100, 金核*2",
        "expiresAt": "2026-05-01T00:00:00Z",
        "createdAt": "2026-04-21T18:00:00Z",
        "updatedAt": "2026-04-21T18:00:00Z",
        "createdByApiKeyName": "admin-bot",
        "createdBySource": "generated"
      }
    ]
  }
}
```

### `POST /api/v1/games/redeem-codes`

说明：

- 仅管理员 API Key 可用
- 如果当前 API Key 不是管理员，返回 `403 当前 apiKey 无管理员权限`

请求体：

```json
{
  "gameCode": "huanta",
  "code": "HT2026SPRING",
  "description": "2026 春季礼包",
  "exchangeRewards": "墨晶*100, 金核*2",
  "expiresAt": "2026-05-01T00:00:00Z"
}
```

说明：

- `gameCode` 必填，当前支持已接入游戏，例如 `huanta`、`yihuan`
- `code` 必填
- `description` 可选
- `exchangeRewards` 可选，表示兑换后可获得的奖励内容
- `expiresAt` 可选，必须是 RFC3339 时间
- `code` 大小写敏感，按原样保存

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "id": 1,
    "gameCode": "huanta",
    "gameName": "幻塔",
    "code": "HT2026SPRING",
    "description": "2026 春季礼包",
    "exchangeRewards": "墨晶*100, 金核*2",
    "expiresAt": "2026-05-01T00:00:00Z",
    "createdAt": "2026-04-21T18:00:00Z",
    "updatedAt": "2026-04-21T18:00:00Z",
    "createdByApiKeyName": "admin-bot",
    "createdBySource": "generated"
  }
}
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "name": "telegram-bot",
    "key_prefix": "tjd-",
    "issued_at": "2026-04-21T12:30:00Z",
    "expires_at": "2026-05-21T12:30:00Z",
    "is_admin": true,
    "source": "generated"
  }
}
```

## 文档默认鉴权写法

当前文档除登录接口与 `/health*` 外，统一按以下请求头传递鉴权信息：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

说明：

- 本文档默认不再把 `apiKey` 放进 URL，也不再把 `fwt` 放进请求体或查询参数示例
- 如果没有传 `X-Framework-Token`，接口会直接返回 `缺少 fwt`
- 如果 `fwt` 不存在、已删除或已失效，接口会直接返回 `当前 fwt 已失效，请重新登录`
- 不再自动回落到当前主账号
- 原始字段 `accessToken / refreshToken / tgdUid / deviceId` 不再作为业务接口入口

## 登录流程

推荐顺序：

1. `POST /api/v1/login/tajiduo/captcha/send`
2. `POST /api/v1/login/tajiduo/session`
3. 客户端只保存返回的 `fwt`
4. 后续所有游戏 / 社区接口都走 `fwt`

平台归属请求头：

```http
X-Platform-Id: telegram
X-Platform-User-Id: 123456789
```

说明：

- 这两个请求头由调用 TaJiDuo API 的上游后端注入
- 终端客户端不需要自己感知或拼接这两个字段
- `POST /api/v1/login/tajiduo/session` 缺少任一请求头时会直接返回 `400`
- 这个登录接口同样需要携带有效 API Key

### `POST /api/v1/login/tajiduo/captcha/send`

请求头：

```http
X-API-Key: your-api-key
```

请求体：

```json
{
  "phone": "13800138000"
}
```

说明：

- `deviceId` 可选
- 不传时后端会自动生成并原样返回

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "deviceId": "4f1de0d7d8b54d0ebc62a74b6aef5e42",
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "手机短信发送成功"
    }
  }
}
```

### `POST /api/v1/login/tajiduo/captcha/check`

请求头：

```http
X-API-Key: your-api-key
```

请求体：

```json
{
  "phone": "13800138000",
  "captcha": "123456",
  "deviceId": "4f1de0d7d8b54d0ebc62a74b6aef5e42"
}
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "success": true,
    "httpStatus": 200,
    "code": 0,
    "message": "手机验证码正确"
  }
}
```

### `POST /api/v1/login/tajiduo/session`

请求头：

```http
X-API-Key: your-api-key
X-Platform-Id: telegram
X-Platform-User-Id: 123456789
```

请求体：

```json
{
  "phone": "13800138000",
  "captcha": "123456",
  "deviceId": "4f1de0d7d8b54d0ebc62a74b6aef5e42"
}
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "username": "jvrAsdSD9",
    "tjdUid": "130707909",
    "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856",
    "platformId": "telegram",
    "platformUserId": "123456789"
  }
}
```

说明：

- `username` 来自用户中心资料里的昵称
- `tjdUid` 来自资料页展示账号，仅作展示
- 当前 `tjd` 账号的个人资料请通过 `GET /api/v1/login/tajiduo/profile` 查询
- 数据库存的仍然是社区真实 `tgdUid`
- `X-Platform-Id + X-Platform-User-Id` 由上游后端注入，不由终端客户端直接传 JSON
- `platformId + platformUserId` 用于隔离第三方平台自己的账号归属
- 同一个 `platformId + platformUserId + tgdUid` 再次登录时，会复用已有账号记录
- 同一个真实社区 `uid` 在不同平台用户下会各自保存为独立账号
- 新登录账号会自动设为主账号
- 原始 token 不会返回给客户端

### `POST /api/v1/login/tajiduo/refresh`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856",
    "platformId": "telegram",
    "platformUserId": "123456789",
    "tgdUid": "10193432",
    "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
    "success": true,
    "message": "刷新成功",
    "updatedAt": "2026-04-21T11:30:00+08:00",
    "lastRefreshAt": "2026-04-21T11:30:00+08:00",
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok",
      "data": {
        "accessToken": "******",
        "refreshToken": "******"
      }
    }
  }
}
```

说明：

- 必须显式传 `fwt`
- 如果 `fwt` 无效、已删除或已失效，返回 `401 当前 fwt 已失效，请重新登录`
- 返回里的 `platformId`、`platformUserId` 表示该 `fwt` 所属的平台用户
- 刷新后的原始 token 只更新数据库，不作为顶层返回字段下发给客户端
- `upstream.data` 是上游原始刷新结果，仅用于排查
- 后端还会按配置做定时刷新

### `GET /api/v1/login/tajiduo/profile`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

说明：

- 必须显式传 `fwt`
- 如果 `fwt` 无效、已删除或已失效，返回 `401 当前 fwt 已失效，请重新登录`
- 这是当前 `fwt` 对应的 `tjd` 账号个人资料
- 顶层只返回 `uid`、`nickname`、`avatar`、`introduce`
- 不对外返回 `account`、`ipRegion`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "uid": 10193432,
    "nickname": "jvrAsdSD9",
    "avatar": "https://serverlist-yh.wmupd.com/notice_test5/pic/icon_t1.png",
    "introduce": "平平无奇"
  }
}
```

### `GET /api/v1/login/tajiduo/accounts`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

说明：

- 必须显式传 `fwt`
- 如果 `fwt` 无效、已删除或已失效，返回 `401 当前 fwt 已失效，请重新登录`
- 只返回当前 `fwt` 所属 `platformId + platformUserId` 下的账号
- `primary` 为当前主账号
- `items[*]` 与 `primary` 结构一致

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "platformId": "telegram",
    "platformUserId": "123456789",
    "items": [
      {
        "platformId": "telegram",
        "platformUserId": "123456789",
        "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856",
        "tgdUid": "10193432",
        "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
        "isPrimary": true,
        "createdAt": "2026-04-20T18:00:00+08:00",
        "updatedAt": "2026-04-21T11:30:00+08:00",
        "lastRefreshAt": "2026-04-21T11:30:00+08:00"
      }
    ],
    "primary": {
      "platformId": "telegram",
      "platformUserId": "123456789",
      "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856",
      "tgdUid": "10193432",
      "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
      "isPrimary": true,
      "createdAt": "2026-04-20T18:00:00+08:00",
      "updatedAt": "2026-04-21T11:30:00+08:00",
      "lastRefreshAt": "2026-04-21T11:30:00+08:00"
    }
  }
}
```

说明：

- 必须显式传 `fwt`
- 如果 `fwt` 无效、已删除或已失效，返回 `401 当前 fwt 已失效，请重新登录`
- `platformId` 与 `platformUserId` 表示当前账号列表所属的平台用户范围

### `POST /api/v1/login/tajiduo/accounts/primary`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "platformId": "telegram",
    "platformUserId": "123456789",
    "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856",
    "tgdUid": "10193432",
    "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
    "isPrimary": true,
    "createdAt": "2026-04-20T18:00:00+08:00",
    "updatedAt": "2026-04-21T11:35:00+08:00",
    "lastRefreshAt": "2026-04-21T11:30:00+08:00"
  }
}
```

### `DELETE /api/v1/login/tajiduo/accounts/:fwt`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "success": true,
    "message": "已退出登录",
    "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856"
  }
}
```

说明：

- 删除的是指定账号
- 如果路径里的 `:fwt` 不存在或已被删除，返回 `401 当前 fwt 已失效，请重新登录`
- 如果删除的是主账号，会自动把同一 `platformId + platformUserId` 下最近使用的下一个账号提升为主账号

## 商城接口

说明：

- 这些接口都要求有效 API Key
- 同时都要求有效 `fwt`
- 本文档默认统一通过请求头 `X-Framework-Token` 传递 `fwt`
- 商城接口当前直接走 TaJiDuo 公共层，不归 `huanta` / `yihuan` 子路由管理
- `gameId` 由调用方显式指定；当前抓包里幻塔使用的是 `1256`

### `GET /api/v1/games/shop/goods`

查询参数：

- `version`：可选，默认 `0`
- `count`：可选，默认 `20`
- `tab`：可选，例如 `all`、`ht`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求示例：

```http
GET /api/v1/games/shop/goods?version=0&count=20&tab=all
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "goods": [
      {
        "id": 10,
        "name": "金币*1000",
        "cover": "https://serverlist-hotta.wmupd.com/notice_test5/pic/jinbi.png",
        "icon": "https://serverlist-hotta.wmupd.com/notice_test5/pic/jinbi.png",
        "price": 300,
        "exchangeNum": 1,
        "cycleLimit": 1,
        "cycleType": 1,
        "nextStock": 0,
        "nextTime": 0,
        "stock": 0,
        "limit": 0,
        "tab": "ht",
        "state": 1
      }
    ],
    "tabs": [
      {
        "key": "ht",
        "name": "幻塔",
        "gameId": 1256
      }
    ],
    "more": false,
    "version": 10,
    "nowTime": 1776811580255,
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok"
    }
  }
}
```

字段说明：

- `stock`：当前库存，对应客户端里的 `库存:1296`、`库存:360`
- `exchangeNum`：当前周期已兑换次数
- `cycleLimit`：当前周期限购次数
- `cycleType`：限购周期类型；当前抓包里 `1` 对应客户端展示的“每月限购”
- 当前抓包里客户端左上角的 `0/1`、`1/1`，更应按 `exchangeNum / cycleLimit` 理解
- `limit` 不是当前这版客户端角标文案的直接来源；例如抓包里 `金币*1000` 的 `limit = 0`，但客户端仍显示 `1/1`
- `nextStock`、`nextTime` 可用于后续补货提示
- `cover`、`icon` 是商品图片地址

补充说明：

- `GET /api/v1/games/shop/goods` 对做商城列表卡片展示已经基本够用
- 如果要拿完整兑换限制，例如社区等级、角色等级、服务器类型限制，仍然应该继续调用 `GET /api/v1/games/shop/goods/:goodsId`

### `GET /api/v1/games/shop/goods/:goodsId`

说明：

- `goodsId` 走路径参数
- 会额外把上游 `rules` JSON 字符串解码到 `rules`
- 原始字符串仍保留在 `rulesRaw`

请求示例：

```http
GET /api/v1/games/shop/goods/8
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "goodsId": "8",
    "item": {
      "id": 8,
      "name": "墨晶*60",
      "price": 1800,
      "detail": "<p>兑换后发放到游戏邮箱</p>",
      "rules": "{\"communityLevel\":3,\"gameRoleLevel\":60,\"supportServerType\":\"0\"}"
    },
    "rules": {
      "communityLevel": 3,
      "gameRoleLevel": 60,
      "supportServerType": "0"
    },
    "rulesRaw": "{\"communityLevel\":3,\"gameRoleLevel\":60,\"supportServerType\":\"0\"}",
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok"
    }
  }
}
```

### `GET /api/v1/games/shop/coin/state`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "todayGet": 110,
    "todayTotal": 150,
    "total": 530,
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok"
    }
  }
}
```

### `GET /api/v1/games/shop/coin/records/income`

查询参数：

- `size`：可选，默认 `20`
- `version`：可选，分页游标，首页传 `0` 或留空

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求示例：

```http
GET /api/v1/games/shop/coin/records/income?size=20&version=0
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "action": 1,
    "actionName": "获取记录",
    "items": [
      {
        "action": 1,
        "createTime": 1776811672706,
        "id": 5447394,
        "num": 50,
        "sourceId": "11953421",
        "title": "首次兑换",
        "type": 2,
        "typeName": "塔吉多任务",
        "uid": 10193432,
        "updateTime": 1776811672715
      }
    ],
    "more": true,
    "version": 1776721725332,
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok"
    }
  }
}
```

说明：

- 这是塔塔币获取流水接口
- 对应上游 `getUserCoinRecords?action=1`
- `version` 是下一页游标
- `more=true` 表示还有更多数据

### `GET /api/v1/games/shop/coin/records/consume`

查询参数：

- `size`：可选，默认 `20`
- `version`：可选，分页游标，首页传 `0` 或留空

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求示例：

```http
GET /api/v1/games/shop/coin/records/consume?size=20&version=0
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "action": 2,
    "actionName": "消耗记录",
    "items": [
      {
        "action": 2,
        "createTime": 1776812672706,
        "id": 5447395,
        "num": 300,
        "sourceId": "10",
        "title": "金币*1000",
        "type": 1,
        "typeName": "商城兑换",
        "uid": 10193432,
        "updateTime": 1776812672715
      }
    ],
    "more": false,
    "version": 1776555801278,
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok"
    }
  }
}
```

说明：

- 这是塔塔币消耗流水接口
- 对应上游 `getUserCoinRecords?action=2`
- `title` 通常会展示消耗来源，例如商城兑换商品
- `version` 是下一页游标

### `GET /api/v1/games/shop/game-roles`

查询参数：

- `gameId`：必填，例如 `1256`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求示例：

```http
GET /api/v1/games/shop/game-roles?gameId=1256
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "gameId": "1256",
    "bindRole": 62719407578902,
    "roles": [
      {
        "gameId": 1256,
        "gender": 1,
        "lev": 44,
        "roleId": 62719407578902,
        "roleName": "㸚#a",
        "serverId": 14603,
        "serverName": "重塑未来"
      }
    ],
    "raw": {
      "bindRole": 62719407578902,
      "roles": [
        {
          "gameId": 1256,
          "gender": 1,
          "lev": 44,
          "roleId": 62719407578902,
          "roleName": "㸚#a",
          "serverId": 14603,
          "serverName": "重塑未来"
        }
      ]
    },
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok"
    }
  }
}
```

### `POST /api/v1/games/shop/exchange`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求体：

```json
{
  "goodsId": "10",
  "gameId": "1256",
  "roleId": "62719407578902",
  "count": 1
}
```

说明：

- `goodsId`、`gameId`、`roleId` 必填
- `count` 可选，默认 `1`
- 当上游返回例如 `塔吉多币不足` 时，本接口会直接返回对应错误消息

成功响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "goodsId": "10",
    "gameId": "1256",
    "roleId": "62719407578902",
    "count": 1,
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok"
    }
  }
}
```

失败响应示例：

```json
{
  "code": 208,
  "message": "塔吉多币不足",
  "data": {
    "upstream": {
      "success": false,
      "httpStatus": 200,
      "code": 208,
      "message": "塔吉多币不足"
    }
  }
}
```

## 公共接口

| 接口 | 用途 |
| --- | --- |
| `GET /health` | 基础健康检查 |
| `GET /health/detailed` | 详细健康检查 |
| `GET /api/v1/games` | 游戏列表 |
| `POST /api/v1/games/community/sign/all` | 提交跨社区批量任务 |
| `GET /api/v1/games/community/sign/tasks/:taskId` | 查询跨社区批量任务状态 |

### `GET /health`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "status": "healthy",
    "timestamp": "2026-04-21T11:40:00+08:00",
    "uptime": 1234,
    "memory": {
      "heapUsedMB": 12,
      "heapTotalMB": 20,
      "sysMB": 28
    },
    "runtime": {
      "version": "go1.25.0",
      "platform": "linux",
      "arch": "amd64",
      "goroutines": 18
    }
  }
}
```

### `GET /health/detailed`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "status": "healthy",
    "timestamp": "2026-04-21T11:40:00+08:00",
    "uptime": 1234,
    "config": {
      "path": "/app/config",
      "tajiduo": {
        "proxyConfigured": false,
        "timeoutSeconds": 30,
        "session": {
          "autoRefreshEnabled": true,
          "autoRefreshIntervalMinutes": 30,
          "autoRefreshTimeoutSeconds": 15
        }
      },
      "huanta": {
        "proxyConfigured": false,
        "timeoutSeconds": 30
      },
      "postgresql": {
        "configured": true,
        "database": "tajiduo",
        "sslmode": "disable",
        "connectTimeout": 5,
        "ready": true,
        "accounts": 2
      }
    },
    "games": [
      {
        "id": "huanta",
        "name": "幻塔",
        "provider": "tajiduo",
        "description": "基于 TaJiDuo 平台的幻塔角色查询与签到能力",
        "routePrefix": "/api/v1/games/huanta"
      },
      {
        "id": "yihuan",
        "name": "异环",
        "provider": "tajiduo",
        "description": "基于 TaJiDuo 平台的异环社区签到与任务能力",
        "routePrefix": "/api/v1/games/yihuan"
      }
    ],
    "runtime": {
      "version": "go1.25.0",
      "platform": "linux",
      "arch": "amd64",
      "goroutines": 18,
      "memory": {
        "heapUsedMB": 12,
        "heapTotalMB": 20,
        "sysMB": 28
      }
    }
  }
}
```

### `GET /api/v1/games`

说明：

- 必须显式传 `fwt`
- 如果 `fwt` 无效、已删除或已失效，返回 `401 当前 fwt 已失效，请重新登录`
- 返回当前服务已接入的游戏目录
- 每个游戏项会给出 `id`、`name`、`provider`、`description`、`routePrefix`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "items": [
      {
        "id": "huanta",
        "name": "幻塔",
        "provider": "tajiduo",
        "description": "基于 TaJiDuo 平台的幻塔角色查询与签到能力",
        "routePrefix": "/api/v1/games/huanta"
      },
      {
        "id": "yihuan",
        "name": "异环",
        "provider": "tajiduo",
        "description": "基于 TaJiDuo 平台的异环社区签到与任务能力",
        "routePrefix": "/api/v1/games/yihuan"
      }
    ]
  }
}
```

### `POST /api/v1/games/community/sign/all`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

固定顺序：

1. 幻塔社区 5 步任务
2. 等待 `betweenCommunitiesMs`
3. 异环社区 5 步任务

推荐请求体：

```json
{
  "actionDelayMs": 3000,
  "stepDelayMs": 8000,
  "betweenCommunitiesMs": 15000
}
```

提交后会立即返回任务信息，不再等待两个社区全部执行完。

响应示例：

```json
{
  "code": 0,
  "message": "任务已开始",
  "data": {
    "taskId": "3e52d60aa7c0441f8f70852f634c6540",
    "scope": "community-batch",
    "status": "pending",
    "completed": false,
    "message": "任务已创建",
    "createdAt": "2026-04-21T12:00:00+08:00",
    "request": {
      "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
      "tgdUid": "10193432",
      "delays": {
        "actionDelayMs": 3000,
        "stepDelayMs": 8000,
        "betweenCommunitiesMs": 15000
      }
    }
  }
}
```

说明：

- 必须显式传 `fwt`
- `actionDelayMs` 默认 `3000`
- `stepDelayMs` 默认 `8000`
- `betweenCommunitiesMs` 默认 `15000`
- 显式传 `0` 表示关闭等待
- 如果当前 `fwt` 无效、已删除，或预检时上游明确判定登录态失效，直接返回 `401`，不会创建任务
- 如果同一个 `fwt` 已经有一个跨社区批量任务在执行，会直接返回同一个 `taskId`
- 复用已有任务时，顶层 `message` 会是 `已有进行中的任务`
- 真正执行结果需要再调用状态查询接口
- `items[*].tasksBefore` / `items[*].tasksAfter` 的结构与各游戏自己的 `community/tasks` 一致
- 当前只会主动执行 5 个任务：签到、浏览帖子、发送主帖、发送评论、点赞帖子
- `被点赞帖子`、`被回复`、`被收藏` 这类被动任务只会体现在任务列表前后对比里，不会被此接口主动触发

### `GET /api/v1/games/community/sign/tasks/:taskId`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

执行中响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "taskId": "3e52d60aa7c0441f8f70852f634c6540",
    "scope": "community-batch",
    "status": "running",
    "completed": false,
    "message": "任务执行中",
    "createdAt": "2026-04-21T12:00:00+08:00",
    "startedAt": "2026-04-21T12:00:00+08:00",
    "request": {
      "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
      "tgdUid": "10193432",
      "delays": {
        "actionDelayMs": 3000,
        "stepDelayMs": 8000,
        "betweenCommunitiesMs": 15000
      }
    }
  }
}
```

执行完成响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "taskId": "3e52d60aa7c0441f8f70852f634c6540",
    "scope": "community-batch",
    "status": "finished",
    "completed": true,
    "success": true,
    "message": "两个社区任务流程执行完成",
    "createdAt": "2026-04-21T12:00:00+08:00",
    "startedAt": "2026-04-21T12:00:00+08:00",
    "finishedAt": "2026-04-21T12:02:01+08:00",
    "request": {
      "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
      "tgdUid": "10193432",
      "delays": {
        "actionDelayMs": 3000,
        "stepDelayMs": 8000,
        "betweenCommunitiesMs": 15000
      }
    },
    "result": {
      "batch": {
        "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
        "tgdUid": "10193432",
        "success": true,
        "message": "两个社区任务流程执行完成",
        "delays": {
          "actionDelayMs": 3000,
          "stepDelayMs": 8000,
          "betweenCommunitiesMs": 15000
        },
        "items": [
          {
            "gameCode": "huanta",
            "gameName": "幻塔",
            "communityId": "1",
            "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
            "tgdUid": "10193432",
            "success": true,
            "message": "社区任务全部完成"
          },
          {
            "gameCode": "yihuan",
            "gameName": "异环",
            "communityId": "2",
            "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
            "tgdUid": "10193432",
            "success": true,
            "message": "社区任务全部完成"
          }
        ]
      }
    }
  }
}
```

说明：

- 必须显式传 `fwt`
- 只能查询当前 `fwt` 自己提交的任务
- 如果当前 `fwt` 已失效，或任务结果已经明确识别到需要重新登录，接口直接返回 `401`
- `status` 只有 `pending`、`running`、`finished`、`failed`
- `finished` 表示流程已经执行完成，最终业务结果看 `success` 和 `result.batch`
- `failed` 表示任务本身执行失败，此时会补 `error`

登录态失效响应示例：

```json
{
  "code": 401,
  "message": "当前 fwt 已失效，请重新登录",
  "data": {
    "taskId": "3e52d60aa7c0441f8f70852f634c6540",
    "scope": "community-batch",
    "status": "failed",
    "completed": true,
    "success": false,
    "message": "当前 fwt 已失效，请重新登录"
  }
}
```
