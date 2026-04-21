# TaJiDuo API

`TaJiDuo` 现在等同于平台登录层与公共接口层。

它只负责：

- 短信验证码
- 登录建会话
- 登录态刷新
- 账号列表 / 主账号切换 / 删除账号
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
- 也支持 `X-Framework-Token`
- 不再兼容把原始 `accessToken / refreshToken / tgdUid / deviceId` 当作业务接口入口
- 除登录接口和健康检查外，其他接口都必须显式传有效 `fwt`

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

## 平台接口

| 接口 | 用途 |
| --- | --- |
| `POST /api/v1/login/tajiduo/captcha/send` | 发送短信验证码 |
| `POST /api/v1/login/tajiduo/captcha/check` | 校验短信验证码 |
| `POST /api/v1/login/tajiduo/session` | 登录并保存账号，返回 `username`、展示用 `tjdUid`、`fwt`、`platformId`、`platformUserId` |
| `POST /api/v1/login/tajiduo/refresh` | 刷新已保存账号 |
| `GET /api/v1/login/tajiduo/accounts` | 查看账号列表 |
| `POST /api/v1/login/tajiduo/accounts/primary` | 切主账号 |
| `DELETE /api/v1/login/tajiduo/accounts/:fwt` | 删除账号 |

## 登录态来源顺序

当前除登录接口与 `/health*` 外，其他接口只接受以下几种 `fwt` 传递方式：

1. 请求体里的 `fwt`
2. 请求头 `X-Framework-Token`
3. 查询参数 `fwt` / `frameworkToken`

说明：

- 如果以上都没传，接口会直接返回 `缺少 fwt`
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

### `POST /api/v1/login/tajiduo/captcha/send`

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
- 数据库存的仍然是社区真实 `tgdUid`
- `X-Platform-Id + X-Platform-User-Id` 由上游后端注入，不由终端客户端直接传 JSON
- `platformId + platformUserId` 用于隔离第三方平台自己的账号归属
- 同一个 `platformId + platformUserId + tgdUid` 再次登录时，会复用已有账号记录
- 同一个真实社区 `uid` 在不同平台用户下会各自保存为独立账号
- 新登录账号会自动设为主账号
- 原始 token 不会返回给客户端

### `POST /api/v1/login/tajiduo/refresh`

推荐请求体：

```json
{
  "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856"
}
```

也可以只传请求头：

```http
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

### `GET /api/v1/login/tajiduo/accounts`

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

请求体：

```json
{
  "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856"
}
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
        },
        "upstreamEndpoint": {
          "sendCaptcha": "bbs-api.tajiduo.com",
          "checkCaptcha": "bbs-api.tajiduo.com",
          "login": "bbs-api.tajiduo.com",
          "userCenter": "bbs-api.tajiduo.com",
          "refreshToken": "bbs-api.tajiduo.com"
        }
      },
      "huanta": {
        "proxyConfigured": false,
        "timeoutSeconds": 30,
        "upstreamEndpoint": {
          "getBindRole": "bbs-api.tajiduo.com",
          "getGameRoles": "bbs-api.tajiduo.com",
          "appSignIn": "bbs-api.tajiduo.com",
          "gameSignIn": "bbs-api.tajiduo.com"
        }
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

固定顺序：

1. 幻塔社区 5 步任务
2. 等待 `betweenCommunitiesMs`
3. 异环社区 5 步任务

推荐请求体：

```json
{
  "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856",
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

请求示例：

```http
GET /api/v1/games/community/sign/tasks/3e52d60aa7c0441f8f70852f634c6540?fwt=0d53c6f8f56f4d7abf53dbf4f68e7856
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
