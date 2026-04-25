<div align="center">

# TaJiDuo-plugin

基于 TaJiDuo API 的 Yunzai-Bot **塔吉多 / 幻塔 / 异环**插件

[安装](#安装) · [登录](#登录) · [配置](#配置) · [命令](#命令) · [数据](#数据与安全)

</div>

---

## 概览

- 当前版本：`0.1.1`
- 默认后端：`https://tajiduo.shallow.ink`
- 测试 API Key：`tjd-8FtI7adTkMHMjZaE`
- 支持 Guoba-Plugin 图形化配置
- 支持网页登录与短信验证码登录
- 支持同一平台用户绑定多个 TaJiDuo 账号
- 支持幻塔 / 异环角色查询、游戏签到、社区任务、签到状态、社区等级
- 支持塔塔币、商城商品、兑换码、收入与消耗记录查询

本插件依赖 TaJiDuo 后端接口。使用前请先在 `config/common.yaml` 中填写可用的 `api_key`。
官方反馈群聊: 1090940860

## 安装

在 Yunzai 根目录执行：

```bash
git clone https://github.com/Entropy-Increase-Team/TaJiDuo-plugin.git ./plugins/TaJiDuo-plugin
```

安装依赖：

```bash
cd ./plugins/TaJiDuo-plugin
pnpm install
```

没有使用 pnpm 的环境可改用：

```bash
npm install
```

插件直接依赖：

| 依赖 | 用途 |
| --- | --- |
| `express` | 网页登录本地 HTTP 服务 |
| `yaml` | 读取与解析 YAML 配置 |
| `chokidar` | 监听配置文件变更 |

## 登录

### 网页登录

默认开启网页登录。发送：

```text
塔吉多登录
tjd登录
```

机器人会返回登录链接。用户在网页完成短信验证后，账号会自动保存，并设为当前默认账号。

如果机器人部署在服务器或反代后面，请把 `config/common.yaml` 里的 `login_server.public_link` 改成公网可访问地址。

### 短信登录

关闭 `login_server.enabled` 后，`tjd登录` 不再生成网页登录链接，改为短信验证码模式：

```text
tjd登录 13800138000
tjd登录 123456
```

也兼容旧命令：

```text
塔吉多验证码 13800138000
塔吉多登录 123456
```

### 多账号

后端按 `platform_id + platform_user_id` 识别一个平台用户。同一平台用户下可保存多个 TaJiDuo 账号，每个 TaJiDuo 账号按 `tgd_uid` 区分。

插件本地会缓存后端账号列表，可使用：

```text
tjd登录列表
tjd切换登录 2
tjd删除登录 2
```

`tjd签到`、`ht签到`、`yh签到` 以及社区签到会遍历当前 QQ 绑定的所有 TaJiDuo 账号。资料、商城等单账号查询默认使用当前账号，可通过 `tjd切换登录 <序号>` 切换。

## 配置

配置文件位于 `plugins/TaJiDuo-plugin/config/`。默认配置位于 `plugins/TaJiDuo-plugin/defSet/`，插件更新默认项时只改 `defSet/`。

首次启动会从 `defSet/` 自动复制常规配置到 `config/`，但 `help.yaml` 与 `message.yaml` 不会自动复制。需要自定义帮助或回复文案时，手动把 `defSet/help.yaml`、`defSet/message.yaml` 复制到 `config/` 后再修改。

### common.yaml

```yaml
base_url: "https://tajiduo.shallow.ink"
api_key: ""
timeout: 25000

login_server:
  enabled: true
  port: 25188
  public_link: "http://127.0.0.1:25188"

community_task:
  action_delay_ms: 3000
  step_delay_ms: 8000
  between_communities_ms: 15000
  poll_times: 8
  poll_interval_ms: 5000
  batch_poll_times: null
```

说明：

| 配置 | 说明 |
| --- | --- |
| `base_url` | TaJiDuo API 服务地址 |
| `api_key` | API Key，通过 `X-API-Key` 请求头传递 |
| `timeout` | 请求超时时间，单位毫秒 |
| `login_server.enabled` | 是否启用网页登录；关闭后使用 `tjd登录 <手机号>` |
| `login_server.port` | 本地 HTTP 登录服务端口 |
| `login_server.public_link` | 发给用户打开的登录地址 |
| `community_task.*` | 社区任务提交和轮询间隔 |

`X-Platform-Id` 默认使用当前机器人账号 ID，`X-Platform-User-Id` 使用触发命令的用户 ID。

### sign.yaml

```yaml
auto_sign: true
auto_sign_cron: "10 1 * * *"
games:
  - huanta
  - yihuan
notify_list:
  friend: []
  group: []
```

开启 `auto_sign` 后，会按 cron 自动执行配置游戏的游戏签到，并向通知列表发送结果。

### Guoba

安装并启用 Guoba-Plugin 后，可在锅巴面板中配置：

- API、网页登录与社区任务参数
- 自动签到与通知列表
- 常用回复文案
- 帮助菜单

## 命令

命令前缀支持中文、英文缩写、`#` 与 `/`：

| 类型 | 前缀 |
| --- | --- |
| 塔吉多 | `塔吉多` / `tjd` / `#tjd` / `/tjd` |
| 幻塔 | `幻塔` / `ht` / `#ht` / `/ht` |
| 异环 | `异环` / `yh` / `#yh` / `/yh` |

### 平台账号

| 命令 | 说明 |
| --- | --- |
| `塔吉多帮助` / `tjd帮助` | 打开帮助菜单 |
| `塔吉多登录` / `tjd登录` | 获取网页登录链接 |
| `塔吉多登录 <手机号>` / `tjd登录 <手机号>` | 关闭网页登录后发送短信验证码 |
| `塔吉多登录 <验证码>` / `tjd登录 <验证码>` | 使用短信验证码完成登录 |
| `塔吉多登录列表` | 查看本地缓存的账号列表 |
| `塔吉多切换登录 <序号>` | 切换当前默认账号 |
| `塔吉多删除登录 <序号>` | 删除指定账号 |
| `塔吉多刷新登录` | 刷新当前账号登录态 |
| `塔吉多资料` | 查询当前塔吉多账号资料 |

### 签到

| 命令 | 说明 |
| --- | --- |
| `塔吉多签到` / `tjd签到` | 为当前 QQ 的所有账号执行幻塔与异环游戏签到 |
| `塔吉多社区签到` / `tjd社区签到` | 为当前 QQ 的所有账号执行幻塔与异环社区任务 |
| `幻塔签到` / `ht签到` | 为当前 QQ 的所有账号执行幻塔游戏签到 |
| `幻塔社区签到` / `ht社区签到` | 为当前 QQ 的所有账号执行幻塔社区任务 |
| `异环签到` / `yh签到` | 为当前 QQ 的所有账号执行异环游戏签到 |
| `异环社区签到` / `yh社区签到` | 为当前 QQ 的所有账号执行异环社区任务 |
| `幻塔全部签到` | 主人命令，为 Redis 内所有用户执行幻塔签到 |
| `异环全部签到` | 主人命令，为 Redis 内所有用户执行异环签到 |

### 幻塔

| 命令 | 说明 |
| --- | --- |
| `幻塔角色` | 查询幻塔角色列表 |
| `幻塔签到状态` | 查询游戏签到状态 |
| `幻塔补签 <角色ID>` | 执行补签 |
| `幻塔社区状态` | 查询社区签到状态 |
| `幻塔社区等级` | 查询社区等级与经验 |
| `幻塔任务` | 查看社区任务列表 |

### 异环

| 命令 | 说明 |
| --- | --- |
| `异环角色` | 查询异环角色列表 |
| `异环主页 [角色ID]` | 查询角色主页，不填则使用第一个角色 |
| `异环成就 [角色ID]` | 查询成就进度 |
| `异环探索 [角色ID]` | 查询区域探索 |
| `异环签到状态` | 查询游戏签到状态 |
| `异环补签 <角色ID>` | 执行补签 |
| `异环社区状态` | 查询社区签到状态 |
| `异环社区等级` | 查询社区等级与经验 |
| `异环任务` | 查看社区任务列表 |

### 商城与兑换码

| 命令 | 说明 |
| --- | --- |
| `塔吉多币` / `tjd币` | 查询塔塔币余额 |
| `塔吉多商城 [幻塔/异环/all]` | 查询商城商品 |
| `塔吉多兑换码 [幻塔/异环]` | 查询兑换码 |
| `塔吉多兑换码 全部` | 查询包含过期项的兑换码 |
| `塔吉多收入` | 查询塔塔币获取记录 |
| `塔吉多消耗` | 查询塔塔币消耗记录 |

## 数据与安全

- 账号数据保存到 Redis：`TJD:USER:${QQ}`。
- 短信验证码临时数据保存到 Redis：`TJD:CAPTCHA:${QQ}`，有效期 10 分钟。
- 网页登录会话保存在插件内存中，登录完成或超时后会清理。
- 本地账号数据会保存 `fwt`、昵称、UID、平台账号 ID、绑定时间等字段，请不要公开 Redis 数据。
- 后端账号归属按 `platform_id + platform_user_id` 隔离，同一平台用户下的 TaJiDuo 账号按 `tgd_uid` 区分。

## 开发

语法检查：

```bash
npm test
```

目录结构：

```text
plugins/TaJiDuo-plugin
├── apps/          # 命令入口
├── components/    # 网页登录服务
├── config/        # 用户配置
├── defSet/        # 默认配置
├── guoba/         # Guoba 配置面板 schema
├── model/         # API 与账号模型
├── resources/     # 帮助图与网页登录页面
└── utils/         # 通用工具
```

## 鸣谢

- TaJiDuo API 后端与文档维护者
- Yunzai 系列机器人框架
- 幻塔、异环相关官方数据来源

## 开源协议

本项目采用 `AGPL-3.0-only` 开源协议。
