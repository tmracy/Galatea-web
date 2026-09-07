<script setup>
import { computed, ref, watch } from 'vue'
import { generateLife, getLife } from '../api/index.js'
import Icon from './Icon.vue'

const props = defineProps({
  sessionId: { type: String, default: '' },
  active: { type: Boolean, default: false },
})

const loading = ref(false)
const generating = ref(false)
const error = ref('')
const notice = ref('')
const status = ref('')
const currentEmotion = ref({})
const nextEventContext = ref('')
const events = ref([])
let requestToken = 0

const EMOTIONS = [
  { key: 'valence', label: '愉快', className: 'rose' },
  { key: 'energy', label: '精力', className: 'gold' },
  { key: 'stress', label: '压力', className: 'violet' },
  { key: 'social_need', label: '想交流', className: 'blue' },
]

const DELTAS = [
  { key: 'valence_delta', label: '愉快' },
  { key: 'energy_delta', label: '精力' },
  { key: 'stress_delta', label: '压力' },
  { key: 'social_need_delta', label: '交流' },
]

const LOCATION_LABELS = {
  home: '家中',
  company: '公司',
  home_to_company: '通勤途中',
  company_to_home: '下班途中',
  home_or_restaurant: '家中或餐厅',
  company_or_restaurant: '公司或餐厅',
  city_or_home: '城市或家中',
  home_or_city: '家中或城市',
}

function chinaDate() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const todayEvents = computed(() =>
  events.value
    .filter((event) => !event?.date || event.date === chinaDate())
    .slice()
    .sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))),
)

const generateLabel = computed(() => {
  if (generating.value) return '故事生成中…'
  if (status.value === 'already_generated') return '本时段已记录'
  if (status.value === 'sleep time') return '她正在休息'
  return '记录此刻'
})

const canGenerate = computed(
  () =>
    !loading.value &&
    !generating.value &&
    status.value !== 'sleep time' &&
    status.value !== 'already_generated',
)

function emotionValue(key) {
  const value = Number(currentEmotion.value?.[key])
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null
}

function locationLabel(location) {
  return LOCATION_LABELS[location] || String(location || '').replaceAll('_', ' ')
}

function eventDeltas(event) {
  return DELTAS.map((item) => ({ ...item, value: Number(event?.[item.key] || 0) }))
    .filter((item) => item.value !== 0)
}

function applyPayload(data) {
  status.value = data?.status || ''
  const emotion = data?.current_emotion
  const fromEvent = data?.event?.current_emotion
  currentEmotion.value =
    emotion && Object.keys(emotion).length ? emotion : fromEvent || {}
  nextEventContext.value =
    data?.next_event_context || data?.event?.next_event_context || ''
  let list = Array.isArray(data?.events) ? data.events.slice() : []
  const generated = data?.event
  if (
    generated &&
    !list.some(
      (item) => item?.date === generated.date && item?.slot_id === generated.slot_id,
    )
  ) {
    list.push(generated)
  }
  events.value = list
}

async function refresh({ silent = false } = {}) {
  if (!props.sessionId) return
  const token = ++requestToken
  if (!silent) loading.value = true
  error.value = ''
  try {
    const data = await getLife({ sessionId: props.sessionId })
    if (token === requestToken) applyPayload(data)
  } catch (err) {
    if (token === requestToken) error.value = `生活动态加载失败：${err.message}`
  } finally {
    if (token === requestToken) loading.value = false
  }
}

async function generate() {
  if (!canGenerate.value) return
  generating.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await generateLife({ sessionId: props.sessionId })
    applyPayload(data)
    if (data?.status === 'already_generated') {
      notice.value = '这个时段的故事已经记录过了。'
    } else if (data?.status === 'sleep time') {
      notice.value = '夜深了，她已经休息。'
    } else {
      notice.value = '她刚刚经历的事，已经写进今天。'
    }
  } catch (err) {
    error.value = `生活事件生成失败：${err.message}`
  } finally {
    generating.value = false
  }
}

watch(
  () => [props.active, props.sessionId],
  ([active, sessionId]) => {
    if (active && sessionId) refresh()
  },
  { immediate: true },
)
</script>

<template>
  <div class="life">
    <div class="ambient" aria-hidden="true">
      <span class="glow rose"></span>
      <span class="glow violet"></span>
    </div>

    <div class="inner">
      <header class="head">
        <div class="title">
          <span class="badge"><Icon name="calendar" :size="19" /></span>
          <div>
            <p class="eyebrow">GALATEA · TODAY</p>
            <h2>她的生活</h2>
            <p class="sub">不在对话里时，她也有自己的时间与心情。</p>
          </div>
        </div>
        <div class="head-actions">
          <button
            type="button"
            class="refresh"
            :disabled="loading || generating"
            aria-label="刷新生活动态"
            title="刷新"
            @click="refresh()"
          >
            <Icon name="refresh" :size="16" />
          </button>
          <button type="button" class="generate" :disabled="!canGenerate" @click="generate">
            <Icon :name="generating ? 'loader' : 'spark'" :size="16" />
            {{ generateLabel }}
          </button>
        </div>
      </header>

      <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
      <p v-else-if="notice" class="feedback notice" role="status">{{ notice }}</p>

      <section class="state-card" aria-labelledby="life-state-title">
        <div class="section-head">
          <div>
            <p class="section-kicker">此刻状态</p>
            <h3 id="life-state-title">她现在感觉如何</h3>
          </div>
          <span
            class="status"
            :class="{ asleep: status === 'sleep time', recorded: status === 'already_generated' }"
          >
            <i></i>{{ status === 'sleep time' ? '休息中' : status === 'already_generated' ? '本时段已记录' : '生活中' }}
          </span>
        </div>

        <div class="emotion-grid">
          <div v-for="emotion in EMOTIONS" :key="emotion.key" class="emotion">
            <div class="emotion-label">
              <span>{{ emotion.label }}</span>
              <strong>{{ emotionValue(emotion.key) ?? '—' }}</strong>
            </div>
            <div class="meter" :class="emotion.className">
              <span :style="{ width: `${emotionValue(emotion.key) ?? 0}%` }"></span>
            </div>
          </div>
        </div>

        <div class="context">
          <span class="context-mark" aria-hidden="true">“</span>
          <div>
            <small>故事还会继续</small>
            <p>
              {{ nextEventContext || '她正在按自己的节奏生活，下一段故事还没有发生。' }}
            </p>
          </div>
        </div>
      </section>

      <section class="timeline" aria-labelledby="life-timeline-title">
        <div class="section-head timeline-head">
          <div>
            <p class="section-kicker">今日轨迹</p>
            <h3 id="life-timeline-title">今天发生的事</h3>
          </div>
          <span class="count">{{ todayEvents.length }} 段故事</span>
        </div>

        <div v-if="loading" class="loading" role="status">
          <span></span><span></span><span></span>
          正在翻开她今天的故事…
        </div>

        <div v-else-if="!todayEvents.length" class="empty">
          <span class="empty-icon"><Icon name="calendar" :size="25" /></span>
          <strong>{{ status === 'sleep time' ? '她已经安静地休息了' : '今天的故事还没有开始' }}</strong>
          <p>
            {{ status === 'sleep time' ? '等她醒来，再看看新一天会发生什么。' : '点击“记录此刻”，生成当前时间段的生活事件。' }}
          </p>
        </div>

        <ol v-else class="event-list">
          <li
            v-for="(event, index) in todayEvents"
            :key="`${event.date || 'today'}-${event.slot_id || index}`"
            class="event-item"
          >
            <div class="time">
              <strong>{{ event.start || '—' }}</strong>
              <span>{{ event.end || '' }}</span>
            </div>
            <span class="timeline-dot" aria-hidden="true"></span>
            <article class="event-card">
              <div class="event-meta">
                <span v-if="event.location">{{ locationLabel(event.location) }}</span>
                <span v-if="event.activity">{{ event.activity }}</span>
              </div>
              <h4>{{ event.event_title || event.activity || '生活片段' }}</h4>
              <p v-if="event.objective_process" class="process">{{ event.objective_process }}</p>
              <p v-if="event.objective_result" class="result">{{ event.objective_result }}</p>
              <p v-if="event.ai_interpretation" class="interpretation">
                {{ event.ai_interpretation }}
              </p>
              <p v-if="event.emotion_reason" class="reason">{{ event.emotion_reason }}</p>
              <div v-if="eventDeltas(event).length" class="deltas" aria-label="情绪变化">
                <span
                  v-for="delta in eventDeltas(event)"
                  :key="delta.key"
                  :class="{ up: delta.value > 0, down: delta.value < 0 }"
                >
                  {{ delta.label }} {{ delta.value > 0 ? '+' : '' }}{{ delta.value }}
                </span>
              </div>
              <div v-if="event.unresolved_threads?.length" class="threads">
                <small>接下来还要</small>
                <span v-for="thread in event.unresolved_threads" :key="thread">{{ thread }}</span>
              </div>
            </article>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.life {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.glow {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.18;
}
.glow.rose {
  top: -120px;
  left: 4%;
  background: rgba(226, 116, 158, 0.7);
}
.glow.violet {
  right: -120px;
  bottom: -120px;
  background: rgba(171, 138, 211, 0.65);
}
.inner {
  position: relative;
  z-index: 1;
  width: min(940px, 100%);
  height: 100%;
  margin: 0 auto;
  padding: 78px 28px 32px;
  overflow-y: auto;
}
.head,
.title,
.head-actions,
.section-head,
.emotion-label,
.event-meta,
.deltas,
.threads {
  display: flex;
  align-items: center;
}
.head {
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}
.title {
  gap: 13px;
  min-width: 0;
}
.badge {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  color: #f5bfd2;
  background: var(--accent-soft);
  border: 1px solid var(--border-strong);
}
.eyebrow,
.section-kicker {
  color: var(--text-faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}
.title h2 {
  margin-top: 1px;
  font-family: var(--font-display);
  font-size: 26px;
  line-height: 1.05;
  font-weight: 600;
}
.sub {
  margin-top: 3px;
  color: var(--text-dim);
  font-size: 12px;
}
.head-actions {
  flex-shrink: 0;
  gap: 8px;
}
.refresh,
.generate {
  min-height: var(--touch-min);
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.refresh {
  width: var(--touch-min);
  color: var(--text-dim);
  background: var(--surface-1);
  border: 1px solid var(--border);
}
.generate {
  gap: 7px;
  padding: 0 17px;
  color: #fff;
  background: var(--accent-grad);
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(177, 76, 117, 0.2);
}
.refresh:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-2);
}
.generate:disabled,
.refresh:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.feedback {
  margin-bottom: 14px;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  border: 1px solid;
}
.feedback.error {
  color: var(--danger);
  background: rgba(255, 107, 123, 0.08);
  border-color: rgba(255, 107, 123, 0.24);
}
.feedback.notice {
  color: var(--text-dim);
  background: var(--accent-soft);
  border-color: var(--border-strong);
}
.state-card,
.timeline {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: rgba(23, 15, 28, 0.7);
}
.state-card {
  padding: 22px;
}
.section-head {
  justify-content: space-between;
  gap: 16px;
}
.section-head h3 {
  margin-top: 3px;
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 600;
}
.status {
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-dim);
  background: var(--surface-1);
  font-size: 11px;
  font-weight: 600;
}
.status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px rgba(118, 213, 163, 0.6);
}
.status.asleep i,
.status.recorded i {
  background: var(--accent-2);
  box-shadow: none;
}
.emotion-grid {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}
.emotion-label {
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--text-dim);
  font-size: 12px;
}
.emotion-label strong {
  color: var(--text);
  font-size: 14px;
}
.meter {
  height: 5px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.08);
}
.meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.45s ease;
}
.meter.rose span { background: #e58bab; }
.meter.gold span { background: #ddb789; }
.meter.violet span { background: #a997d5; }
.meter.blue span { background: #88aeca; }
.context {
  margin-top: 22px;
  padding: 14px 16px;
  border-radius: var(--radius);
  display: flex;
  gap: 12px;
  background: var(--surface-0);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.context-mark {
  flex-shrink: 0;
  font-family: var(--font-display);
  color: var(--accent);
  font-size: 34px;
  line-height: 0.9;
}
.context small {
  color: var(--text-faint);
  font-size: 10px;
  letter-spacing: 0.1em;
}
.context p {
  margin-top: 4px;
  color: var(--text-dim);
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 1.65;
}
.timeline {
  margin-top: 14px;
  padding: 22px;
}
.timeline-head {
  margin-bottom: 20px;
}
.count {
  color: var(--text-faint);
  font-size: 11px;
}
.loading,
.empty {
  min-height: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
}
.loading {
  gap: 5px;
  font-size: 13px;
}
.loading span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.1s ease-in-out infinite;
}
.loading span:nth-child(2) { animation-delay: 0.15s; }
.loading span:nth-child(3) { animation-delay: 0.3s; margin-right: 7px; }
.empty {
  flex-direction: column;
  text-align: center;
}
.empty-icon {
  width: 50px;
  height: 50px;
  margin-bottom: 12px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  color: var(--accent);
  background: var(--accent-soft);
}
.empty strong {
  color: var(--text);
  font-size: 14px;
}
.empty p {
  max-width: 340px;
  margin-top: 6px;
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.6;
}
.event-list {
  list-style: none;
  display: grid;
}
.event-item {
  display: grid;
  grid-template-columns: 46px 14px minmax(0, 1fr);
  gap: 10px;
}
.time {
  padding-top: 4px;
  text-align: right;
  display: flex;
  flex-direction: column;
}
.time strong {
  color: var(--text);
  font-size: 12px;
}
.time span {
  margin-top: 2px;
  color: var(--text-faint);
  font-size: 10px;
}
.timeline-dot {
  position: relative;
}
.timeline-dot::before {
  content: '';
  position: absolute;
  top: 8px;
  left: 50%;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px rgba(243, 142, 175, 0.1);
  transform: translateX(-50%);
}
.timeline-dot::after {
  content: '';
  position: absolute;
  top: 21px;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: var(--border);
}
.event-item:last-child .timeline-dot::after {
  display: none;
}
.event-card {
  margin-bottom: 18px;
  padding: 15px 16px;
  border-radius: var(--radius);
  background: var(--surface-0);
  border: 1px solid rgba(255, 255, 255, 0.065);
}
.event-meta {
  flex-wrap: wrap;
  gap: 6px;
}
.event-meta span {
  padding: 3px 7px;
  border-radius: 6px;
  color: var(--text-faint);
  background: var(--surface-1);
  font-size: 10px;
}
.event-card h4 {
  margin-top: 9px;
  color: var(--text);
  font-size: 15px;
  font-weight: 650;
}
.process,
.result,
.reason {
  margin-top: 7px;
  color: var(--text-dim);
  font-size: 13px;
  line-height: 1.65;
}
.result {
  color: var(--text);
}
.reason {
  color: var(--text-faint);
  font-size: 12px;
}
.interpretation {
  margin-top: 10px;
  padding-left: 11px;
  color: #edd6df;
  font-family: var(--font-display);
  font-size: 14px;
  line-height: 1.65;
  border-left: 2px solid rgba(243, 142, 175, 0.44);
}
.deltas {
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 6px;
}
.deltas span {
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  color: var(--text-faint);
  background: var(--surface-1);
  font-size: 10px;
}
.deltas span.up { color: #e9a7bf; }
.deltas span.down { color: #a9bdd9; }
.threads {
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 6px;
}
.threads small {
  width: 100%;
  color: var(--text-faint);
  font-size: 10px;
}
.threads span {
  color: var(--text-dim);
  font-size: 11px;
}
@keyframes pulse {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}
@media (max-width: 680px) {
  .inner {
    width: 100%;
    padding: max(18px, env(safe-area-inset-top, 0px)) 14px 18px;
  }
  .head {
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .sub {
    display: none;
  }
  .title h2 {
    font-size: 23px;
  }
  .badge {
    width: 42px;
    height: 42px;
    flex-basis: 42px;
  }
  .generate {
    width: var(--touch-min);
    padding: 0;
    font-size: 0;
    gap: 0;
  }
  .state-card,
  .timeline {
    padding: 17px 15px;
    border-radius: var(--radius);
  }
  .emotion-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px 18px;
  }
  .context {
    margin-top: 18px;
  }
  .event-item {
    grid-template-columns: 42px 10px minmax(0, 1fr);
    gap: 7px;
  }
  .event-card {
    padding: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading span {
    animation: none;
  }
  .meter span {
    transition: none;
  }
}
</style>
