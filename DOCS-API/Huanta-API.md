# Huanta API

本文档描述幻塔模块接口。

在调用本文件中的接口前，请先参考 [TaJiDuo-API.md](./TaJiDuo-API.md) 完成：

- `fwt` 获取
- 默认请求头 `X-API-Key` + `X-Framework-Token`
- 平台层账号管理
- 首次登录时由上游后端注入 `X-Platform-Id` 与 `X-Platform-User-Id`

## 模块信息

- `gameCode = huanta`
- `gameId = 1256`
- `communityId = 1`
- 路由前缀：`/api/v1/games/huanta`

## 响应格式

当前接口统一返回：

```json
{
  "code": 0,
  "message": "成功",
  "data": {}
}
```

错误响应示例：

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

## 登录态使用方式

本文档默认统一使用请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

支持规则：

- 必须显式传 `fwt`
- 本文档默认不再把 `apiKey` 放进 URL，也不再把 `fwt` 放进请求体或查询参数示例
- 不接受原始 `accessToken / refreshToken / tgdUid / deviceId` 作为业务接口入口
- 当前 `fwt` 无效、已删除或已失效时返回 `401`
- 不再自动回落到主账号

## 已实现接口

| 接口 | 用途 | 说明 |
| --- | --- | --- |
| `GET /api/v1/games/huanta/roles` | 拉取角色列表 | 读绑定角色 + 角色列表 |
| `GET /api/v1/games/huanta/sign/state` | 游戏签到状态 | 查询今日是否已签 |
| `GET /api/v1/games/huanta/sign/rewards` | 游戏签到奖励表 | 支持可选 `roleId` |
| `GET /api/v1/games/huanta/sign/resign-info` | 游戏补签信息 | 查询补签次数、消耗与余额 |
| `POST /api/v1/games/huanta/sign/game` | 单角色游戏签到 | 只处理一个 `roleId` |
| `POST /api/v1/games/huanta/sign/resign` | 单角色游戏补签 | 需要 `roleId` |
| `POST /api/v1/games/huanta/sign/all` | 幻塔聚合签到 | 社区签到 + 游戏签到 |
| `POST /api/v1/games/huanta/sign/app` | 社区签到单步 | 只做社区签到 |
| `POST /api/v1/games/huanta/community/sign/all` | 提交社区 5 步任务 | 不做游戏签到 |
| `GET /api/v1/games/huanta/community/sign/tasks/:taskId` | 查询社区任务状态 | 返回异步执行结果 |
| `GET /api/v1/games/huanta/community/sign/state` | 社区签到状态 | 查询是否已签到 |
| `GET /api/v1/games/huanta/community/tasks` | 社区任务列表 | 默认 `gid = 2` |
| `GET /api/v1/games/huanta/community/exp/level` | 社区等级 | 查询经验等级 |
| `GET /api/v1/games/huanta/community/exp/records` | 社区经验流水 | 查询经验记录 |

## 游戏接口

### `GET /api/v1/games/huanta/roles`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

作用：

- 聚合绑定角色
- 聚合角色列表
- 给 `sign/game` 和 `sign/all` 提供 `roleId`

说明：

- 现在使用 `GET`
- 必须显式传 `fwt`
- 当前 `fwt` 无效、已删除或已失效时返回 `401`
- 不再自动回落到主账号

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "deviceId": "device-x",
    "tgdUid": "10001",
    "roles": [
      {
        "roleId": "20001",
        "roleName": "Aster",
        "gameId": "1256"
      },
      {
        "roleId": "20002",
        "roleName": "Shirli",
        "gameId": "1256"
      }
    ],
    "upstream": {
      "bindRole": {
        "success": true,
        "httpStatus": 200,
        "code": 0,
        "message": "ok"
      },
      "gameRoles": {
        "success": true,
        "httpStatus": 200,
        "code": 0,
        "message": "ok"
      }
    }
  }
}
```

### `GET /api/v1/games/huanta/sign/state`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

作用：

- 查询幻塔游戏签到状态
- 判断今天是否已完成游戏签到

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "gameId": "1256",
    "day": 23,
    "days": 0,
    "month": 4,
    "reSignCnt": 0,
    "todaySign": false
  }
}
```

说明：

- `todaySign` 表示今天是否已签到
- `days` 表示当前累计签到天数
- `reSignCnt` 表示当前补签次数

### `GET /api/v1/games/huanta/sign/rewards`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

查询参数：

- `roleId`：可选

作用：

- 查询幻塔游戏签到奖励表
- 抓包里该接口支持附带 `roleId`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "gameId": "1256",
    "roleId": "20001",
    "items": [
      {
        "name": "墨晶",
        "num": 50
      }
    ]
  }
}
```

说明：

- 不传 `roleId` 也可以返回奖励表
- 响应中会保留上游归一化结果到 `upstream`

### `GET /api/v1/games/huanta/sign/resign-info`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

作用：

- 查询幻塔游戏补签信息
- 用于判断补签次数、补签消耗与补签币余额

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "gameId": "1256",
    "coin": 390,
    "cost": 200,
    "reSignCnt": 0,
    "reSignLimit": 3,
    "todaySign": true
  }
}
```

说明：

- `coin` 是当前补签币余额
- `cost` 是本次补签消耗
- `reSignCnt` 是当前已补签次数
- `reSignLimit` 是补签上限

### `POST /api/v1/games/huanta/sign/game`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求：

```json
{
  "roleId": "20001"
}
```

作用：

- 只执行单个角色的游戏签到

说明：

- 必须显式传 `fwt`
- 当前 `fwt` 无效、已删除或已失效时返回 `401`
- `roleId` 仍然必须显式传

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "success": true,
    "httpStatus": 200,
    "code": 0,
    "message": "ok"
  }
}
```

说明：

- 这个接口直接返回单次游戏签到的上游归一化结果
- 与 `sign/all` 不同，它不会额外整理成角色级摘要

### `POST /api/v1/games/huanta/sign/resign`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求：

```json
{
  "roleId": "20001"
}
```

作用：

- 只执行单个角色的游戏补签

响应示例：

```json
{
  "code": 0,
  "message": "幻塔游戏补签成功",
  "data": {
    "gameId": "1256",
    "roleId": "20001",
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

- 必须显式传 `fwt`
- 当前 `fwt` 无效、已删除或已失效时返回 `401`
- `roleId` 仍然必须显式传
- 补签前建议先查 `sign/resign-info`

### `POST /api/v1/games/huanta/sign/all`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求：

```json
{
}
```

也支持显式传角色：

```json
{
  "roles": [
    {
      "roleId": "20001",
      "roleName": "Aster",
      "gameId": "1256"
    }
  ]
}
```

它会尽量完成：

1. 使用已保存 `refreshToken` 刷新账号
2. 自动补拉角色
3. 执行 `sign/app`
4. 对每个角色执行 `sign/game`

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "deviceId": "device-x",
    "tgdUid": "10001",
    "roles": [
      {
        "roleId": "20001",
        "roleName": "Aster",
        "gameId": "1256"
      },
      {
        "roleId": "20002",
        "roleName": "Shirli",
        "gameId": "1256"
      }
    ],
    "app": {
      "success": true,
      "message": "社区任务签到成功，获得5经验，12金币",
      "exp": 5,
      "goldCoin": 12
    },
    "games": [
      {
        "role": {
          "roleId": "20001",
          "roleName": "Aster",
          "gameId": "1256"
        },
        "success": true,
        "message": "获得墨晶*50",
        "reward": "获得墨晶*50"
      },
      {
        "role": {
          "roleId": "20002",
          "roleName": "Shirli",
          "gameId": "1256"
        },
        "success": true,
        "message": "获得墨晶*50",
        "reward": "获得墨晶*50"
      }
    ],
    "upstream": {
      "refresh": {
        "success": true,
        "httpStatus": 200,
        "code": 0,
        "message": "ok"
      },
      "bindRole": {
        "success": true,
        "httpStatus": 200,
        "code": 0,
        "message": "ok"
      },
      "gameRoles": {
        "success": true,
        "httpStatus": 200,
        "code": 0,
        "message": "ok"
      },
      "signState": {
        "success": true,
        "httpStatus": 200,
        "code": 0,
        "message": "ok"
      },
      "signRewards": {
        "success": true,
        "httpStatus": 200,
        "code": 0,
        "message": "ok"
      }
    }
  }
}
```

说明：

- 必须显式传 `fwt`
- 当前 `fwt` 无效、已删除或已失效时返回 `401`
- 如果本次走的是已保存账号，刷新后的原始 token 只会回写数据库
- 响应里不会返回 `accessToken`、`refreshToken`
- `app` 是社区签到摘要
- `games[*]` 是每个角色的游戏签到摘要

## 社区接口

### `POST /api/v1/games/huanta/sign/app`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求：

```json
{}
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "communityId": "1",
    "success": true,
    "message": "社区任务签到成功，获得5经验，12金币",
    "exp": 5,
    "goldCoin": 12,
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

- 必须显式传 `fwt`
- 当前 `fwt` 无效、已删除或已失效时返回 `401`

### `POST /api/v1/games/huanta/community/sign/all`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

请求：

```json
{
  "actionDelayMs": 3000,
  "stepDelayMs": 8000
}
```

固定跑 5 步：

1. 签到
2. 浏览帖子
3. 发送主帖
4. 发送评论
5. 点赞帖子

提交后会立即返回任务信息，不再等待 5 步全部执行完。

响应示例：

```json
{
  "code": 0,
  "message": "任务已开始",
  "data": {
    "taskId": "5a8b9f3df3b646efa2ce8663427440a1",
    "gameCode": "huanta",
    "gameName": "幻塔",
    "scope": "community-game",
    "status": "pending",
    "completed": false,
    "message": "任务已创建",
    "createdAt": "2026-04-21T12:05:00+08:00",
    "request": {
      "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
      "tgdUid": "10193432",
      "delays": {
        "actionDelayMs": 3000,
        "stepDelayMs": 8000
      }
    }
  }
}
```

说明：

- 必须显式传 `fwt`
- 如果当前 `fwt` 无效、已删除，或预检时上游明确判定登录态失效，直接返回 `401`，不会创建任务
- 这是社区任务接口，不是游戏签到接口
- 如果同一个 `fwt` 已经有一个幻塔社区任务在执行，会直接返回同一个 `taskId`
- 复用已有任务时，顶层 `message` 会是 `已有进行中的任务`
- `betweenCommunitiesMs` 在单社区接口里不生效
- 真正执行结果需要再调用状态查询接口

### `GET /api/v1/games/huanta/community/sign/tasks/:taskId`

请求头：

```http
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

执行完成响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "taskId": "5a8b9f3df3b646efa2ce8663427440a1",
    "gameCode": "huanta",
    "gameName": "幻塔",
    "scope": "community-game",
    "status": "finished",
    "completed": true,
    "success": true,
    "message": "社区任务全部完成",
    "createdAt": "2026-04-21T12:05:00+08:00",
    "startedAt": "2026-04-21T12:05:00+08:00",
    "finishedAt": "2026-04-21T12:05:46+08:00",
    "request": {
      "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
      "tgdUid": "10193432",
      "delays": {
        "actionDelayMs": 3000,
        "stepDelayMs": 8000
      }
    },
    "result": {
      "item": {
        "gameCode": "huanta",
        "gameName": "幻塔",
        "communityId": "1",
        "deviceId": "a054f73b9a3f9aafd1f8b006e8a595d9",
        "tgdUid": "10193432",
        "success": true,
        "message": "社区任务全部完成",
        "delays": {
          "actionDelayMs": 3000,
          "stepDelayMs": 8000
        },
        "tasksBefore": [
          {
            "taskKey": "signin_exp",
            "title": "签到",
            "completeTimes": 0,
            "limitTimes": 1,
            "targetTimes": 1,
            "remaining": 1
          }
        ],
        "tasksAfter": [
          {
            "taskKey": "signin_exp",
            "title": "签到",
            "completeTimes": 1,
            "limitTimes": 1,
            "targetTimes": 1,
            "remaining": 0
          }
        ],
        "steps": [
          {
            "taskKey": "signin_exp",
            "title": "签到",
            "planned": 1,
            "alreadyComplete": 0,
            "remainingBefore": 1,
            "attempted": 1,
            "successCount": 1,
            "success": true,
            "message": "社区任务签到成功，获得5经验，12金币"
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
- `result.item.tasksBefore` / `result.item.tasksAfter` 的结构与 `community/tasks` 一致
- 当前“社区任务全部完成”只按 5 个主动任务判断

登录态失效响应示例：

```json
{
  "code": 401,
  "message": "当前 fwt 已失效，请重新登录",
  "data": {
    "taskId": "5a8b9f3df3b646efa2ce8663427440a1",
    "gameCode": "huanta",
    "gameName": "幻塔",
    "scope": "community-game",
    "status": "failed",
    "completed": true,
    "success": false,
    "message": "当前 fwt 已失效，请重新登录"
  }
}
```

### `GET /api/v1/games/huanta/community/sign/state`

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
    "communityId": "1",
    "signed": true,
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok",
      "data": true
    }
  }
}
```

说明：

- 必须显式传 `fwt`
- 现在使用 `GET`
- 如果上游明确判定登录态失效，接口会转成 `401`

### `GET /api/v1/games/huanta/community/tasks`

请求：

```http
GET /api/v1/games/huanta/community/tasks?gid=2
X-API-Key: your-api-key
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "communityId": "1",
    "gid": 2,
    "groups": [
      {
        "key": "task_list3",
        "items": [
          {
            "taskKey": "signin_exp",
            "title": "签到",
            "uid": "10193432",
            "exp": 5,
            "coin": 0,
            "completeTimes": 1,
            "contTimes": 0,
            "limitTimes": 1,
            "period": 20260421,
            "targetTimes": 1
          },
          {
            "taskKey": "browse_post_exp",
            "title": "浏览帖子",
            "uid": "10193432",
            "exp": 5,
            "coin": 0,
            "completeTimes": 1,
            "contTimes": 0,
            "limitTimes": 1,
            "period": 20260421,
            "targetTimes": 1
          }
        ]
      }
    ]
  }
}
```

说明：

- 必须显式传 `fwt`
- 现在使用 `GET`
- 这是“任务完成情况接口”
- 如果上游明确判定登录态失效，接口会转成 `401`
- 判断是否完成，通常看 `completeTimes >= limitTimes`
- 当前主动执行的 5 个任务对应：
  - `signin_exp`
  - `browse_post_exp`
  - `send_post_exp`
  - `send_comment_exp`
  - `like_post_exp`
- 上游还可能返回 `被点赞帖子`、`被回复`、`被收藏` 等其他任务项，具体 `taskKey` 以上游实际返回为准

### `GET /api/v1/games/huanta/community/exp/level`

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
    "communityId": "1",
    "exp": 95,
    "level": 2,
    "levelExp": 55,
    "nextLevel": 3,
    "nextLevelExp": 200,
    "todayExp": 90,
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

- 必须显式传 `fwt`
- 现在使用 `GET`
- 如果上游明确判定登录态失效，接口会转成 `401`

### `GET /api/v1/games/huanta/community/exp/records`

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
    "communityId": "1",
    "items": [
      {
        "communityId": "1",
        "title": "签到",
        "sourceId": "10869184",
        "uid": "10193432",
        "type": 3,
        "num": 5,
        "createTime": 1776530262742,
        "updateTime": 1776530262744
      }
    ]
  }
}
```

说明：

- 必须显式传 `fwt`
- 现在使用 `GET`
- 如果上游明确判定登录态失效，接口会转成 `401`

## 默认发帖内容

社区 5 步任务里的“发送主帖”默认固定为：

- 标题：`每日打卡`
- 正文从以下 3 个里随机：
  - `打卡~`
  - `打卡打卡`
  - `早早早`

当前“发送评论”默认固定为：

- `hihihi`

## 当前边界

- `community/sign/all` 当前只会主动执行 5 个任务，不会主动补 `被点赞帖子`、`被回复`、`被收藏`
- `sign/game` 是单角色直接签到接口，返回的是单次上游归一化结果，不是聚合摘要
