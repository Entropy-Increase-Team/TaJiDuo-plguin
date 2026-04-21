# TaJiDuo-plugin

Yunzai-Bot 的塔吉多社区插件。

当前版本专注于塔吉多登录态管理与社区签到，支持幻塔、异环，以及一键社区签到。

## 功能简介

- 短信验证码登录塔吉多账号
- 查看当前登录账号
- 刷新当前登录账号
- 退出当前登录
- 删除当前登录账号
- 社区签到
- 社区查询
- 兑换码查询
- 每天 `00:20` 自动社区签到

## 安装方式

### GitHub HTTPS

```bash
git clone https://github.com/Entropy-Increase-Team/TaJiDuo-plguin.git ./plugins/TaJiDuo-plugin
```

安装完成后，重启 Yunzai 即可加载插件。

## 配置文件

默认配置：

- [config/tajiduo_default.yaml](./config/tajiduo_default.yaml)

实际生效配置：

- `plugins/TaJiDuo-plugin/config/config/tajiduo.yaml`

当前默认配置：

```yaml
tajiduo:
  base_url: 'https://tajiduo.shallow.ink'
  api_key: 'tjd-8FtI7adTkMHMjZaE'
  client_id: ''
  request_timeout_ms: 15000
  captcha_wait_timeout_ms: 300000
  community_task_timeout_ms: 300000
  action_delay_ms: 3000
  step_delay_ms: 8000
  between_communities_ms: 15000
```

字段说明：

- `base_url`: 塔吉多后端地址
- `api_key`: TaJiDuo API Key，会作为 `X-API-Key` 发送
- `client_id`: 客户端 ID，会作为 `X-Platform-Id` 发送，建议使用 ASCII 标识
- `request_timeout_ms`: 普通请求超时
- `captcha_wait_timeout_ms`: 登录等待验证码超时
- `community_task_timeout_ms`: 社区任务总超时
- `action_delay_ms`: 单步动作间隔
- `step_delay_ms`: 步骤间隔
- `between_communities_ms`: 一键社区签到时两个社区之间的间隔

说明：

- `base_url` 即使只写 `tajiduo.shallow.ink`，插件也会自动补上 `https://`
- `api_key` 会统一作为请求头 `X-API-Key` 发送；当前插件也兼容读取 `apikey / apiKey`
- README 中示例测试 `api_key`：`tjd-8FtI7adTkMHMjZaE`
- 登录建会话时会通过请求头注入 `X-Platform-Id` 与 `X-Platform-User-Id`
- `X-Platform-Id` 使用 `client_id`
- `X-Platform-User-Id` 使用发送命令的用户 ID
- `client_id` 需要是可安全放入 HTTP 头的 ASCII 标识
- `action_delay_ms`、`step_delay_ms`、`between_communities_ms` 支持设置为 `0`，表示关闭对应等待

## 命令说明

命令前缀支持：

- `#塔吉多`
- `#tjd`
- `#TJD`
- `#TjD`

### 帮助命令

| 命令 | 说明 |
| --- | --- |
| `#塔吉多帮助` | 查看帮助 |

### 登录命令

其中只有 `#塔吉多登录 13800138000` 和后续 `6` 位验证码需要私聊发送，其他账号管理命令支持群聊触发：

| 命令 | 说明 |
| --- | --- |
| `#塔吉多登录 13800138000` | 发送验证码并等待下一条 `6` 位验证码 |
| `#塔吉多账号` | 查看当前登录账号 |
| `#塔吉多刷新登录` | 刷新当前登录账号 |
| `#塔吉多退出登录` | 退出当前登录 |
| `#塔吉多删除账号` | 删除当前登录账号 |

### 签到命令

| 命令 | 说明 |
| --- | --- |
| `#塔吉多异环社区签到` | 提交异环社区签到任务并等待结果 |
| `#塔吉多幻塔社区签到` | 提交幻塔社区签到任务并等待结果 |
| `#塔吉多社区签到` | 提交幻塔 + 异环社区签到任务并等待结果 |
| `#塔吉多异环社区查询` | 查询异环社区等级与任务进度 |
| `#塔吉多幻塔社区查询` | 查询幻塔社区等级与任务进度 |
| `#塔吉多社区查询` | 查询幻塔 + 异环社区等级与任务进度 |

说明：

- 社区查询会使用合并转发消息展示等级信息与任务明细

### 兑换码命令

这些命令不需要登录即可使用：

| 命令 | 说明 |
| --- | --- |
| `#塔吉多异环兑换码` | 查看异环当前可用兑换码 |
| `#塔吉多幻塔兑换码` | 查看幻塔当前可用兑换码 |
| `#塔吉多兑换码` | 查看当前全部可用兑换码 |

## 自动社区签到

插件会在每天 `00:20` 自动遍历 Redis 中已保存的账号，并执行一键社区签到：

- `POST /api/v1/games/community/sign/all`
- `GET /api/v1/games/community/sign/tasks/:taskId`

如果当前没有已保存账号，自动任务会直接跳过，并在日志中输出提示。

## 反馈

- 反馈 QQ 群：`1090940860`
