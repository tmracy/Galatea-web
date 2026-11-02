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
  {
    id: 'lose_weight',
    name: '沈砚',
    description: '减肥陪练教练',
    active: false,
    builtin: true,
  },
]

export function mockListSkills() {
  return new Promise((resolve) => setTimeout(() => resolve(DEFAULT_SKILLS), 200))
}

export function mockUploadSkill(skill) {
  return new Promise((resolve) => setTimeout(() => resolve({ ...skill, mock: true }), 300))
}

function mockLifeEvent() {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return {
    date,
    slot_id: 'workday_afternoon_work',
    start: '13:31',
    end: '18:00',
    location: 'company',
    activity: '承接上午事项并完成下午工作',
    event_title: '把棘手的报表理顺了',
    objective_process: '下午集中核对了几组数据，并把遗漏的项目逐一补齐。',
    objective_result: '报表按时完成，晚上的安排没有受到影响。',
    ai_interpretation: '虽然中间有一点烦躁，但真正完成之后还是很有成就感。',
    emotion_reason: '任务顺利收尾，压力有所下降。',
    valence_delta: 7,
    energy_delta: -5,
    stress_delta: -8,
    social_need_delta: 3,
    unresolved_threads: [],
    share_desire: 7,
    memory_worthiness: 'medium',
    next_event_context: '工作已经收尾，准备下班回家。',
    current_emotion: { valence: 72, energy: 58, stress: 24, social_need: 51 },
  }
}

export function mockLife() {
  return Promise.resolve({
    code: 0,
    status: 'ok',
    current_emotion: { valence: 65, energy: 70, stress: 30, social_need: 45 },
    next_event_context: '',
    events: [],
  })
}

export function mockSelectSkill({ skillId }) {
  return Promise.resolve({ code: 0, skill_id: skillId || 'hh' })
}

export function mockMemory() {
  return Promise.resolve({
    code: 0,
    memories: ['用户喜欢晚上散步。', '用户最近在准备作品集。'],
    communities: [{ summary: '日常作息与工作节奏', community_data: ['晚间散步', '作品集'] }],
  })
}

const MOCK_PLAZA = [
  {
    id: 'demo-linxia',
    name: '林夏',
    introduction: '住在对街的插画师，话不多，但会等你说完。',
    kaichangbai: '下班了？我刚到家，水还烧着。',
    skill: '---\nname: 林夏\ndescription: |\n  对街的插画师\n---\n# 林夏\n',
    public: true,
    stars: 3,
    starred: false,
  },
]

export function mockPlaza(kind) {
  return Promise.resolve(kind === 'mine' ? [] : MOCK_PLAZA)
}

export function mockCreateCharacter({ sessionId, name, kaichangbai, introduction }) {
  const skill = `---\nname: ${name || '自定义角色'}\ndescription: |\n  ${introduction || '自定义陪伴人设'}\n---\n\n# ${name || '自定义角色'} · 陪伴人设\n\n${kaichangbai || ''}\n`
  return Promise.resolve({ skill, raw: { [sessionId]: skill } })
}

export function mockGenerateLife() {
  const event = mockLifeEvent()
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          code: 0,
          status: 'ok',
          event,
          current_emotion: event.current_emotion,
          next_event_context: event.next_event_context,
          events: [event],
        }),
      700,
    ),
  )
}
