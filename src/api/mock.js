// 本地 mock：后端未连通时让 UI 仍可演示。
const REPLIES = [
  '嗯，姐姐在听呢，今天过得怎么样呀？',
  '累啦？快歇会儿，跟姐姐说说今天又忙啥了。',
  '别急，慢慢说，我都在。',
  '哈哈你这张嘴，越来越会逗姐姐开心了。',
  '深圳今天热得不行，我刚撸完猫，正想着你呢。',
]

let i = 0

export function mockChat(text) {
  i = (i + 1) % REPLIES.length
  const base = REPLIES[i]
  const reply = text ? `${base}` : '再见啦，记得想姐姐哦。'
  return new Promise((resolve) => {
    setTimeout(() => resolve({ reply, audioUrl: null, mock: true }), 500)
  })
}

const DEFAULT_SKILLS = [
  {
    id: 'hh',
    name: '明日香',
    description: '29岁，温柔姐姐',
    active: true,
    builtin: true,
  },
]

export function mockListSkills() {
  return new Promise((resolve) => setTimeout(() => resolve(DEFAULT_SKILLS), 200))
}

export function mockUploadSkill(skill) {
  return new Promise((resolve) => setTimeout(() => resolve({ ...skill, mock: true }), 300))
}
