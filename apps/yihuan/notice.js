import TaJiDuoRequest from '../../model/tajiduoReq.js'
import {
  formatTime,
  getMessage,
  PREFIX,
  summarizeApiError,
  trimMsg
} from '../../utils/common.js'

const NOTICE_COLUMN_NAME = '「袋先生」邮箱'
const NOTICE_TYPES = [
  { id: 1, label: '资讯' },
  { id: 2, label: '活动' },
  { id: 3, label: '公告' }
]

function toArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.list)) return value.list
  return []
}

function dataBody(res = {}) {
  return res.data?.data ?? res.data ?? {}
}

function findNoticeColumnId(value) {
  const stack = Array.isArray(value) ? [...value] : [value]
  while (stack.length > 0) {
    const item = stack.shift()
    if (!item || typeof item !== 'object') continue
    const name = item.columnName || item.name || item.title
    if (name === NOTICE_COLUMN_NAME || String(name || '').includes('袋先生')) {
      return item.id || item.columnId
    }
    for (const child of Object.values(item)) {
      if (Array.isArray(child)) stack.push(...child)
      else if (child && typeof child === 'object') stack.push(child)
    }
  }
  return ''
}

function mergeAuthors(posts = [], users = []) {
  const userMap = new Map(toArray(users).map((user) => [String(user.uid || user.id || ''), user]))
  return toArray(posts).map((post) => {
    const user = userMap.get(String(post.uid || post.userId || '')) || {}
    return {
      ...post,
      authorName: post.authorName || user.nickname || user.name || '',
      authorAvatar: post.authorAvatar || user.avatar || ''
    }
  })
}

function cleanPostText(text = '') {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickPreview(post = {}) {
  const image = toArray(post.images)[0]
  const vod = toArray(post.vods)[0]
  return image?.url || vod?.cover || ''
}

function renderPostItem(post = {}) {
  return {
    id: post.postId || post.post_id || post.id || '',
    title: post.subject || post.title || '未命名',
    author: post.authorName || '官方',
    time: formatTime(post.createTime || post.create_time),
    preview: pickPreview(post),
    content: cleanPostText(post.content || post.structuredContent).slice(0, 1200)
  }
}

export class notice extends plugin {
  constructor() {
    super({
      name: '[TaJiDuo-plugin]异环公告',
      dsc: '异环公告列表/详情',
      event: 'message',
      priority: 50,
      rule: [
        {
          reg: `^${PREFIX.yihuan}公告(?:\\s*\\d+)?$`,
          fnc: 'yihuanNotice'
        }
      ]
    })
  }

  async getNoticeColumnId(req) {
    const res = await req.getData('community_web_all')
    if (!res || Number(res.code) !== 0) return { error: summarizeApiError(res) }
    const id = findNoticeColumnId(dataBody(res))
    if (!id) return { error: '未找到异环公告栏目' }
    return { id }
  }

  async yihuanNotice() {
    const req = new TaJiDuoRequest('', { log: false })
    const postId = trimMsg(this.e).match(/\d{5,}/)?.[0] || ''
    if (postId) return this.noticeDetail(req, postId)

    const column = await this.getNoticeColumnId(req)
    if (column.error) {
      await this.reply(getMessage('common.request_failed', { error: column.error }))
      return true
    }

    const lines = ['异环公告']
    const sections = []
    for (const type of NOTICE_TYPES) {
      const res = await req.getData('community_web_official_posts', {
        columnId: column.id,
        officialType: type.id,
        count: 4,
        version: 0
      })
      if (!res || Number(res.code) !== 0) {
        const error = summarizeApiError(res)
        sections.push({ label: type.label, posts: [], error })
        lines.push(`【${type.label}】${error}`)
        continue
      }

      const data = dataBody(res)
      const posts = mergeAuthors(data.posts || data.items || data.list, data.users)
      sections.push({
        label: type.label,
        posts: posts.slice(0, 4).map(renderPostItem),
        error: ''
      })
      lines.push(`【${type.label}】`)
      if (posts.length === 0) {
        lines.push(getMessage('common.no_data'))
        continue
      }
      for (const post of posts.slice(0, 4)) {
        lines.push(`${post.postId || post.post_id || post.id} | ${post.subject || post.title || '未命名'} | ${formatTime(post.createTime || post.create_time)}`)
      }
    }
    lines.push('查看详情：yh公告 <帖子ID>')
    await this.reply(lines.join('\n'))
    return true
  }

  async noticeDetail(req, postId) {
    const res = await req.getData('community_web_post_full', { postId })
    if (!res || Number(res.code) !== 0) {
      await this.reply(getMessage('common.request_failed', { error: summarizeApiError(res) }))
      return true
    }

    const data = dataBody(res)
    const post = mergeAuthors([data.post || data], data.users)[0] || {}
    const postData = renderPostItem(post)
    const lines = [
      `异环公告详情：${post.subject || post.title || postId}`,
      `ID：${post.postId || post.post_id || post.id || postId}`,
      `作者：${post.authorName || '官方'}`,
      `时间：${formatTime(post.createTime || post.create_time)}`
    ]
    const content = cleanPostText(post.content || post.structuredContent)
    if (content) lines.push('', content.slice(0, 1200))
    const preview = pickPreview(post)
    if (preview) lines.push('', `图片/封面：${preview}`)
    await this.reply(lines.join('\n'))
    return true
  }
}
