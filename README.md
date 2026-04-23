# TaJiDuo-plugin

Yunzai-Bot 的塔吉多社区插件。

当前版本已支持塔吉多登录态管理、游戏签到、社区签到、商城查询与商品兑换，覆盖幻塔、异环以及一键社区签到。

## 测试 API Key

以下测试 `API Key` 可直接填写到配置里的 `api_key` 字段用于联调：

```yaml
api_key: 'tjd-8FtI7adTkMHMjZaE'
```

如果你只是先跑通插件，建议先直接使用这一个测试 `API Key`。

## 功能简介

- 短信验证码登录塔吉多账号
- 查看当前登录账号
- 刷新当前登录账号
- 退出当前登录
- 删除当前登录账号
- 幻塔游戏签到
- 异环游戏签到
- 社区签到
- 社区查询
- 商城商品列表
- 商城商品详情
- 塔吉多币状态
- 商城角色查询
- 商品兑换
- 兑换码查询
- 每天 `00:20` 自动社区签到
- 自动签到结果推送到群聊 / 好友
- `tjd更新` 插件更新命令

## 安装方式

### GitHub HTTPS

```bash
git clone https://github.com/Entropy-Increase-Team/TaJiDuo-plugin.git ./plugins/TaJiDuo-plugin
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
  api_key: ''
  client_id: ''
  request_timeout_ms: 15000
  captcha_wait_timeout_ms: 300000
  community_task_timeout_ms: 300000
  action_delay_ms: 3000
  step_delay_ms: 8000
  between_communities_ms: 15000
  auto_sign:
    enabled: true
    cron: '0 20 0 * * *'
    notify_list:
      friend: []
      group: []
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
- `auto_sign.enabled`: 是否开启每日自动社区签到
- `auto_sign.cron`: 自动社区签到 cron
- `auto_sign.notify_list.friend`: 自动签到开始/完成时推送到这些 QQ 私聊
- `auto_sign.notify_list.group`: 自动签到开始/完成时推送到这些群

说明：

- `base_url` 即使只写 `tajiduo.shallow.ink`，插件也会自动补上 `https://`
- `api_key` 会统一作为请求头 `X-API-Key` 发送；当前插件也兼容读取 `apikey / apiKey`
- 登录成功后保存的 `fwt` 会统一作为请求头 `X-Framework-Token` 发送，不再放进请求体或查询参数
- 登录建会话时会通过请求头注入 `X-Platform-Id` 与 `X-Platform-User-Id`
- `X-Platform-Id` 使用 `client_id`
- `X-Platform-User-Id` 使用发送命令的用户 ID
- `client_id` 需要是可安全放入 HTTP 头的 ASCII 标识
- `action_delay_ms`、`step_delay_ms`、`between_communities_ms` 支持设置为 `0`，表示关闭对应等待

## 命令说明

命令前缀支持：

- `tjd`：总命令前缀
- `tof / ht / 幻塔`：幻塔命令前缀
- `nte / yh / 异环`：异环命令前缀

大小写可混用，例如：

- `tjd帮助`
- `TjD帮助`
- `tof社区签到`
- `ht签到`
- `NtE兑换码`
- `yh签到`

### 帮助命令

| 命令 | 说明 |
| --- | --- |
| `tjd帮助 / tof帮助 / ht帮助 / nte帮助 / yh帮助` | 查看帮助 |
| `tjd更新` | 更新插件，仅主人可用 |

### 登录命令

其中只有 `tjd登录 13800138000` 和后续 `6` 位验证码需要私聊发送，其他账号管理命令支持群聊触发：

| 命令 | 说明 |
| --- | --- |
| `tjd登录 13800138000` | 发送验证码并等待下一条 `6` 位验证码 |
| `tjd账号` | 查看当前登录账号 |
| `tjd刷新登录` | 刷新当前登录账号 |
| `tjd退出登录` | 退出当前登录 |
| `tjd删除账号` | 删除当前登录账号 |

### 签到命令

| 命令 | 说明 |
| --- | --- |
| `tof签到 / ht签到 / 幻塔签到` | 执行幻塔游戏签到，默认优先使用绑定角色，支持 `角色ID / 序号 / 角色名` |
| `nte签到 / yh签到 / 异环签到` | 执行异环游戏签到，默认优先使用绑定角色，支持 `角色ID / 序号 / 角色名` |
| `nte社区签到 / yh社区签到 / 异环社区签到` | 提交异环社区签到任务并等待结果 |
| `tof社区签到 / ht社区签到 / 幻塔社区签到` | 提交幻塔社区签到任务并等待结果 |
| `tjd社区签到` | 提交幻塔 + 异环社区签到任务并等待结果 |
| `nte社区查询 / yh社区查询 / 异环社区查询` | 查询异环社区等级与任务进度 |
| `tof社区查询 / ht社区查询 / 幻塔社区查询` | 查询幻塔社区等级与任务进度 |
| `tjd社区查询` | 查询幻塔 + 异环社区等级与任务进度 |

说明：

- `tof签到` / `ht签到` 默认优先使用绑定角色；多角色时可用 `ht签到 1`、`ht签到 <roleId>` 或 `ht签到 <角色名>`
- `nte签到` / `yh签到` 默认优先使用绑定角色；多角色时可用 `yh签到 1`、`yh签到 <roleId>` 或 `yh签到 <角色名>`
- 社区查询会使用合并转发消息展示等级信息与任务明细
- 仍兼容原来的 `tjd幻塔签到 / tjd异环签到 / tjd幻塔社区签到 / tjd异环社区签到 / tjd幻塔社区查询 / tjd异环社区查询`

### 商城命令

这些命令需要先完成登录：

| 命令 | 说明 |
| --- | --- |
| `tjd商城` | 查询商城商品列表，发送后会提示选择账号 |
| `tjd商品 8` | 查询指定商品详情，支持 `商品ID / 商品名称` |
| `tjd塔币查询` | 查询当前塔吉多币状态，发送后会提示选择账号 |
| `tjd商城角色列表` | 查询当前账号的商城角色列表，发送后会提示选择账号 |
| `tjd兑换商品 10 1` | 兑换指定商品，支持 `商品ID / 商品名称 + 数量`，发送后会提示选择账号 |

### 兑换码命令

这些命令不需要登录即可使用：

| 命令 | 说明 |
| --- | --- |
| `nte兑换码 / yh兑换码 / 异环兑换码` | 查看异环当前可用兑换码 |
| `tof兑换码 / ht兑换码 / 幻塔兑换码` | 查看幻塔当前可用兑换码 |
| `tjd兑换码` | 查看当前全部可用兑换码 |

## 自动社区签到

插件会按 `tajiduo.auto_sign.cron` 定时遍历 Redis 中已保存的账号，并执行一键社区签到：

- `POST /api/v1/games/community/sign/all`
- `GET /api/v1/games/community/sign/tasks/:taskId`

如果当前没有已保存账号，自动任务会直接跳过，并在日志中输出提示。

如果配置了通知列表，自动签到开始和完成时会推送到对应好友 / 群：

```yaml
tajiduo:
  auto_sign:
    enabled: true
    cron: '0 20 0 * * *'
    notify_list:
      friend:
        - '123456789'
      group:
        - '987654321'
```

也可以通过 `guoba.support.js` 在锅巴面板中直接配置这些项目。

## 反馈

- 反馈 QQ 群：`1090940860`

## 协议

本项目采用 `GNU AGPLv3` 协议开源。

- 协议文件：[LICENSE](./LICENSE)
