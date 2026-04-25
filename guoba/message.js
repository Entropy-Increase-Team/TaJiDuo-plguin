/** 锅巴配置：常用回复文案 */
export default function getMessageSchemas() {
  return [
    {
      label: '消息配置',
      component: 'SOFT_GROUP_BEGIN'
    },
    {
      component: 'Alert',
      componentProps: {
        type: 'info',
        message: '文案支持原有占位符，例如 {game}、{message}、{taskId}。保存后写入 config/message.yaml。'
      }
    },
    {
      component: 'Divider',
      label: '基础文案'
    },
    {
      field: 'message.unbind_message',
      label: '未绑定账号提示',
      component: 'InputTextArea',
      componentProps: { rows: 3 }
    },
    {
      field: 'message.prefixTips',
      label: '前缀提示',
      component: 'Input'
    },
    {
      field: 'message.common.loading',
      label: '请求等待提示',
      component: 'Input'
    },
    {
      field: 'message.common.query_failed',
      label: '查询失败提示',
      component: 'Input'
    },
    {
      field: 'message.common.sign_busy',
      label: '签到占用提示',
      component: 'Input'
    },
    {
      component: 'Divider',
      label: '登录文案'
    },
    {
      field: 'message.login.captcha_usage',
      label: '验证码用法',
      component: 'Input'
    },
    {
      field: 'message.login.captcha_sent',
      label: '验证码已发送',
      component: 'InputTextArea',
      componentProps: { rows: 3 }
    },
    {
      field: 'message.login.web_disabled',
      label: '网页登录关闭提示',
      component: 'Input'
    },
    {
      field: 'message.login.web_link',
      label: '网页登录链接提示',
      component: 'InputTextArea',
      componentProps: { rows: 4 }
    },
    {
      field: 'message.login.web_timeout',
      label: '网页登录超时',
      component: 'Input'
    },
    {
      field: 'message.login.pending_missing',
      label: '缺少待校验手机号',
      component: 'Input'
    },
    {
      field: 'message.login.login_success',
      label: '登录成功',
      component: 'InputTextArea',
      componentProps: { rows: 3 }
    },
    {
      field: 'message.login.account_title',
      label: '账号列表标题',
      component: 'Input'
    },
    {
      component: 'Divider',
      label: '游戏签到文案'
    },
    {
      field: 'message.game.sign_start',
      label: '签到开始',
      component: 'Input'
    },
    {
      field: 'message.game.sign_done',
      label: '签到完成',
      component: 'Input'
    },
    {
      field: 'message.game.sign_failed',
      label: '签到失败',
      component: 'Input'
    },
    {
      field: 'message.game.sign_state',
      label: '签到状态',
      component: 'Input'
    },
    {
      field: 'message.game.already_signed',
      label: '已签到状态',
      component: 'Input'
    },
    {
      field: 'message.game.not_signed',
      label: '未签到状态',
      component: 'Input'
    },
    {
      component: 'Divider',
      label: '社区任务文案'
    },
    {
      field: 'message.community.task_start',
      label: '任务提交',
      component: 'InputTextArea',
      componentProps: { rows: 3 }
    },
    {
      field: 'message.community.task_done',
      label: '任务完成',
      component: 'Input'
    },
    {
      field: 'message.community.task_running',
      label: '任务执行中',
      component: 'InputTextArea',
      componentProps: { rows: 3 }
    },
    {
      field: 'message.community.task_failed',
      label: '任务失败',
      component: 'Input'
    },
    {
      field: 'message.community.state',
      label: '社区签到状态',
      component: 'Input'
    },
    {
      field: 'message.community.level',
      label: '社区等级',
      component: 'Input'
    },
    {
      component: 'Divider',
      label: '商城与帮助'
    },
    {
      field: 'message.shop.coin',
      label: '塔塔币',
      component: 'InputTextArea',
      componentProps: { rows: 3 }
    },
    {
      field: 'message.shop.goods_title',
      label: '商城标题',
      component: 'Input'
    },
    {
      field: 'message.shop.code_title',
      label: '兑换码标题',
      component: 'Input'
    },
    {
      field: 'message.help.title',
      label: '帮助标题',
      component: 'Input'
    }
  ]
}
