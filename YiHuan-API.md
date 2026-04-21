# YiHuan API

本文档描述异环模块接口。

在调用本文件中的接口前，请先参考 [TaJiDuo-API.md](./TaJiDuo-API.md) 完成：

- `fwt` 获取
- `X-Framework-Token` 传递方式
- 平台层账号管理
- 首次登录时由上游后端注入 `X-Platform-Id` 与 `X-Platform-User-Id`

## 模块信息

- `gameCode = yihuan`
- 参考主游戏 `gameId = 1289`
- `communityId = 2`
- 路由前缀：`/api/v1/games/yihuan`
- 当前只开放社区层能力

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

推荐只用：

```json
{
  "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856"
}
```

或者请求头：

```http
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

补充：

- 必须显式传 `fwt`
- 支持请求体 `fwt`
- 支持请求头 `X-Framework-Token`
- 支持查询参数 `fwt`
- 不接受原始 `accessToken / refreshToken / tgdUid / deviceId` 作为业务接口入口
- 当前 `fwt` 无效、已删除或已失效时返回 `401`
- 不再自动回落到主账号

## 已实现接口

| 接口 | 用途 | 说明 |
| --- | --- | --- |
| `POST /api/v1/games/yihuan/sign/app` | 社区签到单步 | 只做签到 |
| `POST /api/v1/games/yihuan/community/sign/all` | 提交社区 5 步任务 | 不做游戏签到 |
| `GET /api/v1/games/yihuan/community/sign/tasks/:taskId` | 查询社区任务状态 | 返回异步执行结果 |
| `GET /api/v1/games/yihuan/community/sign/state` | 社区签到状态 | 查询是否已签到 |
| `GET /api/v1/games/yihuan/community/tasks` | 社区任务列表 | 默认 `gid = 2` |
| `GET /api/v1/games/yihuan/community/exp/level` | 社区等级 | 查询经验等级 |
| `GET /api/v1/games/yihuan/community/exp/records` | 社区经验流水 | 查询经验记录 |

## 核心接口

### `POST /api/v1/games/yihuan/sign/app`

请求：

```json
{
  "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856"
}
```

作用：

- 只做异环社区签到单步

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "communityId": "2",
    "success": true,
    "message": "社区任务签到成功，获得5经验，12金币",
    "exp": 5,
    "goldCoin": 12,
    "upstream": {
      "success": true,
      "httpStatus": 200,
      "code": 0,
      "message": "ok",
      "data": {
        "exp": 5,
        "goldCoin": 12
      }
    }
  }
}
```

说明：

- 如果今天已经签过，会被归一化成成功响应
- `alreadySigned` 为 `true` 时表示今天已签过
- 必须显式传 `fwt`
- 当前 `fwt` 无效、已删除或已失效时返回 `401`

### `POST /api/v1/games/yihuan/community/sign/all`

请求：

```json
{
  "fwt": "0d53c6f8f56f4d7abf53dbf4f68e7856",
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
    "taskId": "c593bf0748c7496dbe6f50fce89a6b5b",
    "gameCode": "yihuan",
    "gameName": "异环",
    "scope": "community-game",
    "status": "pending",
    "completed": false,
    "message": "任务已创建",
    "createdAt": "2026-04-21T12:10:00+08:00",
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
- 如果同一个 `fwt` 已经有一个异环社区任务在执行，会直接返回同一个 `taskId`
- 复用已有任务时，顶层 `message` 会是 `已有进行中的任务`
- 真正执行结果需要再调用状态查询接口

### `GET /api/v1/games/yihuan/community/sign/tasks/:taskId`

请求示例：

```http
GET /api/v1/games/yihuan/community/sign/tasks/c593bf0748c7496dbe6f50fce89a6b5b?fwt=0d53c6f8f56f4d7abf53dbf4f68e7856
```

执行完成响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "taskId": "c593bf0748c7496dbe6f50fce89a6b5b",
    "gameCode": "yihuan",
    "gameName": "异环",
    "scope": "community-game",
    "status": "finished",
    "completed": true,
    "success": true,
    "message": "社区任务全部完成",
    "createdAt": "2026-04-21T12:10:00+08:00",
    "startedAt": "2026-04-21T12:10:00+08:00",
    "finishedAt": "2026-04-21T12:10:47+08:00",
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
        "gameCode": "yihuan",
        "gameName": "异环",
        "communityId": "2",
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
          },
          {
            "taskKey": "browse_post_exp",
            "title": "浏览帖子",
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
          },
          {
            "taskKey": "browse_post_exp",
            "title": "浏览帖子",
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
          },
          {
            "taskKey": "browse_post_exp",
            "title": "浏览帖子",
            "planned": 1,
            "alreadyComplete": 0,
            "remainingBefore": 1,
            "attempted": 1,
            "successCount": 1,
            "success": true,
            "message": "浏览帖子任务完成"
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
- `result.item.tasksBefore` / `result.item.tasksAfter` 来自任务列表接口
- `result.item.steps` 表示本次主动执行的 5 个任务
- 当前“社区任务全部完成”只按这 5 个主动任务判断
- `被点赞帖子`、`被回复`、`被收藏` 这类被动任务即使仍未完成，也会继续体现在 `result.item.tasksAfter`

登录态失效响应示例：

```json
{
  "code": 401,
  "message": "当前 fwt 已失效，请重新登录",
  "data": {
    "taskId": "c593bf0748c7496dbe6f50fce89a6b5b",
    "gameCode": "yihuan",
    "gameName": "异环",
    "scope": "community-game",
    "status": "failed",
    "completed": true,
    "success": false,
    "message": "当前 fwt 已失效，请重新登录"
  }
}
```

### `GET /api/v1/games/yihuan/community/sign/state`

请求头：

```http
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "communityId": "2",
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
- 这个接口只表示“今天社区签到是否已完成”
- 不表示整套社区任务是否全部完成
- 如果上游明确判定登录态失效，接口会转成 `401`

### `GET /api/v1/games/yihuan/community/tasks`

请求：

```http
GET /api/v1/games/yihuan/community/tasks?gid=2
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "communityId": "2",
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
- 判断某项任务是否完成，通常看 `completeTimes >= limitTimes`；如果 `limitTimes` 为空，再看 `targetTimes`
- 当前主动执行的 5 个任务对应：
  - `signin_exp`
  - `browse_post_exp`
  - `send_post_exp`
  - `send_comment_exp`
  - `like_post_exp`
- 上游还可能返回 `被点赞帖子`、`被回复`、`被收藏` 等其他任务项，具体 `taskKey` 以上游实际返回为准

### `GET /api/v1/games/yihuan/community/exp/level`

请求头：

```http
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "communityId": "2",
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

### `GET /api/v1/games/yihuan/community/exp/records`

请求头：

```http
X-Framework-Token: 0d53c6f8f56f4d7abf53dbf4f68e7856
```

响应示例：

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "communityId": "2",
    "items": [
      {
        "communityId": "2",
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

- 这是经验流水接口
- `title` 为经验来源说明
- `num` 为本次经验增量
- 必须显式传 `fwt`
- 现在使用 `GET`
- 如果上游明确判定登录态失效，接口会转成 `401`

## 当前边界

- 当前没有 `POST /api/v1/games/yihuan/roles`
- 当前没有 `POST /api/v1/games/yihuan/sign/game`
- 当前没有 `POST /api/v1/games/yihuan/sign/all`
- `community/sign/all` 当前只会主动执行 5 个任务，不会主动补 `被点赞帖子`、`被回复`、`被收藏`
- 不要把 HAR 里出现的 `1257` 当成异环主游戏 ID
