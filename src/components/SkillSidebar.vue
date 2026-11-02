<script setup>
import { ref, onMounted, watch } from 'vue'
import {
  listSkills,
  uploadSkill,
  selectSkill,
  getMemory,
  createCharacter,
  listMyCharacters,
  listPlaza,
  publishCharacter,
  deleteCharacter,
  starCharacter,
} from '../api/index.js'
import { parseFrontmatter } from '../utils/frontmatter.js'
import { skillDisplayName } from '../utils/skillName.js'
import Icon from './Icon.vue'

const BUILTINS = [
  {
    id: 'hh',
    characterId: 'hh',
    skillId: 'hh',
    name: '明日香',
    description: '温柔姐姐，日常陪伴',
    builtin: true,
  },
  {
    id: 'lose_weight',
    characterId: 'lose_weight',
    skillId: 'lose_weight',
    name: '沈砚',
    description: '减肥陪练教练',
    builtin: true,
  },
]

const props = defineProps({
  sessionId: { type: String, default: '' },
  characterId: { type: String, default: 'hh' },
})
const emit = defineEmits(['activate', 'logout', 'guide'])

const tab = ref('mine') // mine | plaza | memory
const skills = ref([])
const mine = ref([])
const plaza = ref([])
const loading = ref(true)
const switching = ref(false)
const uploading = ref(false)
const error = ref('')
const fileInput = ref(null)
const preview = ref(null)

const creating = ref(false)
const generating = ref(false)
const publishing = ref(false)
const makePublic = ref(true)
const form = ref(emptyForm())
const generated = ref('')

const memories = ref([])
const communities = ref([])
const memoryLoading = ref(false)
const memoryError = ref('')

function emptyForm() {
  return { name: '', introduction: '', kaichangbai: '', character: '', talk: '' }
}

function storageKey(sid) {
  return `galatea_character_${sid}`
}

function remember(characterId) {
  if (props.sessionId && characterId) {
    localStorage.setItem(storageKey(props.sessionId), characterId)
  }
}

function emitSkill(skill) {
  remember(skill.characterId)
  emit('activate', skill)
}

function inferBuiltin(list) {
  const current = list.find((s) => s.active) || list[0]
  if (!current || current.builtin === false) return ''
  return skillDisplayName(current) === '沈砚' ? 'lose_weight' : 'hh'
}

function markActive(id) {
  skills.value = skills.value.map((s) => ({ ...s, active: s.id === id }))
}

async function refreshSkills() {
  if (!props.sessionId) {
    skills.value = []
    mine.value = []
    return
  }
  const [list, mineList] = await Promise.all([
    listSkills(props.sessionId),
    listMyCharacters(props.sessionId).catch(() => []),
  ])
  mine.value = mineList
  const named = list.map((s) => ({ ...s, name: skillDisplayName(s) }))
  const custom = named.find((s) => s.builtin === false)
  const saved = localStorage.getItem(storageKey(props.sessionId))
  const activeId =
    saved || (custom ? custom.id || props.sessionId : inferBuiltin(list) || 'hh')
  skills.value = BUILTINS.map((s) => ({
    ...s,
    active: s.id === activeId,
  }))
  if (custom) {
    const customId = custom.id || props.sessionId
    skills.value.push({
      ...custom,
      id: customId,
      characterId: mineList.some((p) => p.id === activeId) ? activeId : 'hh',
      active: activeId === customId,
    })
  }
  const fromMine = mineList.find((p) => p.id === activeId)
  const fromBuiltin = skills.value.find((s) => s.id === activeId && s.builtin)
  const fromCustom = skills.value.find((s) => s.active && !s.builtin)
  const current =
    fromBuiltin ||
    (fromMine
      ? {
          id: fromMine.id,
          characterId: fromMine.id,
          name: fromMine.name,
          description: fromMine.introduction,
          kaichangbai: fromMine.kaichangbai,
          skill: fromMine.skill,
          builtin: false,
          active: true,
        }
      : fromCustom || skills.value.find((s) => s.active) || skills.value[0])
  if (current) emitSkill(current)
}

async function refreshPlaza() {
  if (!props.sessionId) {
    plaza.value = []
    return
  }
  plaza.value = await listPlaza(props.sessionId)
}

onMounted(async () => {
  try {
    await refreshSkills()
  } catch (e) {
    error.value = '加载人设失败：' + (e.message || e)
    skills.value = BUILTINS.map((s) => ({ ...s, active: s.id === 'hh' }))
    emitSkill(skills.value[0])
  } finally {
    loading.value = false
  }
})

watch(
  () => props.sessionId,
  async (id) => {
    if (!id) return
    loading.value = true
    error.value = ''
    try {
      await refreshSkills()
    } catch (e) {
      error.value = '加载人设失败：' + (e.message || e)
      skills.value = []
    } finally {
      loading.value = false
    }
  },
)

watch(tab, async (next) => {
  error.value = ''
  if (next === 'plaza') {
    try {
      await refreshPlaza()
    } catch (e) {
      error.value = '加载广场失败：' + (e.message || e)
    }
  }
  if (next === 'memory') loadMemory()
})

watch(
  () => props.characterId,
  () => {
    if (tab.value === 'memory') loadMemory()
  },
)

function pickFile() {
  fileInput.value?.click()
}

async function onFile(e) {
  error.value = ''
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.name.endsWith('.md')) {
    error.value = '请选择 .md 文件'
    return
  }
  const content = await file.text()
  const { data, body } = parseFrontmatter(content)
  if (!data.name) {
    error.value = '未找到 frontmatter 中的 name 字段，请检查 skill.md 格式'
  }
  preview.value = {
    id: props.sessionId || data.name || file.name.replace(/\.md$/, ''),
    name: data.name || file.name,
    description: (data.description || body.slice(0, 120)).trim(),
    content,
  }
  e.target.value = ''
}

async function confirmUpload() {
  if (!preview.value) return
  if (!props.sessionId) {
    error.value = '请先登录后再上传人设'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const saved = await uploadSkill({
      ...preview.value,
      sessionId: props.sessionId,
    })
    const skill = {
      id: saved.id || props.sessionId,
      name: skillDisplayName({ ...saved, name: saved.name || preview.value.name }),
      description: saved.description || preview.value.description,
      characterId: 'hh',
      active: true,
      builtin: false,
    }
    markActive('hh')
    skills.value = [
      ...BUILTINS.map((s) => ({ ...s, active: false })),
      skill,
    ]
    emitSkill(skill)
    preview.value = null
  } catch (e) {
    error.value = '上传失败：' + e.message
  } finally {
    uploading.value = false
  }
}

function onPick(s) {
  if (s.builtin) return activateBuiltin(s)
  if (s.skill) return usePersona(s)
  if (s.active) return
  markActive(s.id)
  emitSkill({ ...s, active: true })
}

async function activateBuiltin(item) {
  if (switching.value || skills.value.find((s) => s.active)?.id === item.id) return
  switching.value = true
  error.value = ''
  try {
    await selectSkill({ sessionId: props.sessionId, skillId: item.skillId })
    markActive(item.id)
    emitSkill({ ...item, active: true })
  } catch (e) {
    error.value = '切换人设失败：' + e.message
  } finally {
    switching.value = false
  }
}

async function usePersona(card) {
  if (switching.value || !card?.skill) {
    if (!card?.skill) error.value = '这个人设还没有可启用的内容'
    return
  }
  switching.value = true
  error.value = ''
  try {
    await uploadSkill({
      sessionId: props.sessionId,
      content: card.skill,
      name: card.name,
      description: card.introduction,
    })
    const skill = {
      id: card.id,
      characterId: card.id,
      name: card.name,
      description: card.introduction,
      kaichangbai: card.kaichangbai,
      skill: card.skill,
      active: true,
      builtin: false,
    }
    markActive(card.id)
    emitSkill(skill)
    tab.value = 'mine'
  } catch (e) {
    error.value = '启用失败：' + e.message
  } finally {
    switching.value = false
  }
}

async function onStar(card, evt) {
  evt?.stopPropagation?.()
  try {
    const res = await starCharacter({ sessionId: props.sessionId, id: card.id })
    const patch = (list) =>
      list.map((p) =>
        p.id === card.id ? { ...p, stars: res.stars, starred: res.starred } : p,
      )
    plaza.value = patch(plaza.value)
    mine.value = patch(mine.value)
  } catch (e) {
    error.value = '点赞失败：' + e.message
  }
}

async function onDelete(card, evt) {
  evt?.stopPropagation?.()
  if (!confirm(`删除「${card.name}」？`)) return
  try {
    await deleteCharacter({ sessionId: props.sessionId, id: card.id })
    mine.value = mine.value.filter((p) => p.id !== card.id)
    plaza.value = plaza.value.filter((p) => p.id !== card.id)
    if (props.characterId === card.id) await activateBuiltin(BUILTINS[0])
  } catch (e) {
    error.value = '删除失败：' + e.message
  }
}

async function generatePersona() {
  if (!form.value.name.trim() || !form.value.character.trim()) {
    error.value = '请至少填写名字和人设'
    return
  }
  generating.value = true
  error.value = ''
  try {
    const res = await createCharacter({
      sessionId: props.sessionId,
      ...form.value,
    })
    generated.value = res.skill
  } catch (e) {
    error.value = '生成失败：' + e.message
  } finally {
    generating.value = false
  }
}

async function enableGenerated() {
  if (!generated.value) return
  publishing.value = true
  error.value = ''
  try {
    const published = await publishCharacter({
      sessionId: props.sessionId,
      name: form.value.name,
      introduction: form.value.introduction,
      kaichangbai: form.value.kaichangbai,
      skill: generated.value,
      public: makePublic.value,
    })
    await usePersona({
      id: published.id,
      name: form.value.name,
      introduction: form.value.introduction,
      kaichangbai: form.value.kaichangbai,
      skill: generated.value,
    })
    creating.value = false
    generated.value = ''
    form.value = emptyForm()
    await refreshSkills()
  } catch (e) {
    error.value = '启用失败：' + e.message
  } finally {
    publishing.value = false
  }
}

async function loadMemory() {
  if (!props.sessionId) return
  memoryLoading.value = true
  memoryError.value = ''
  try {
    const data = await getMemory({
      sessionId: props.sessionId,
      characterId: props.characterId,
    })
    memories.value = data.memories || []
    communities.value = data.communities || []
  } catch (e) {
    memoryError.value = e.message || '读取记忆失败'
    memories.value = []
    communities.value = []
  } finally {
    memoryLoading.value = false
  }
}

function openCreate() {
  creating.value = !creating.value
  generated.value = ''
  error.value = ''
  tab.value = 'mine'
}

function personaActive(id) {
  return props.characterId === id
}
</script>

<template>
  <aside class="sidebar glass">
    <div class="sidebar-head">
      <div class="brand">
        <div class="logo">G</div>
        <div class="brand-copy">
          <h1>Galatea</h1>
          <p class="user-id" :title="sessionId">@{{ sessionId }}</p>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="角色与记忆">
        <button type="button" role="tab" :class="{ on: tab === 'mine' }" @click="tab = 'mine'">角色</button>
        <button type="button" role="tab" :class="{ on: tab === 'plaza' }" @click="tab = 'plaza'">广场</button>
        <button type="button" role="tab" :class="{ on: tab === 'memory' }" @click="tab = 'memory'">记忆</button>
      </div>

      <div class="section-title">
        <span>{{ tab === 'plaza' ? '人设广场' : tab === 'memory' ? '她记得的事' : '我的角色' }}</span>
        <button v-if="tab === 'mine'" class="add" :disabled="uploading" @click="pickFile">
          <Icon name="plus" :size="14" />
          导入
        </button>
        <button v-if="tab === 'mine'" class="add" :disabled="switching" @click="openCreate">
          <Icon name="spark" :size="14" />
          {{ creating ? '收起' : '创建' }}
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".md,text/markdown"
          hidden
          @change="onFile"
        />
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="preview" class="preview">
      <div class="preview-head">
        <strong>{{ preview.name }}</strong>
        <span class="tag">待确认</span>
      </div>
      <p class="desc">{{ preview.description }}</p>
      <div class="preview-actions">
        <button class="ghost" @click="preview = null">取消</button>
        <button class="primary" :disabled="uploading" @click="confirmUpload">
          {{ uploading ? '上传中…' : '确认启用' }}
        </button>
      </div>
    </div>

    <div v-if="creating && tab === 'mine'" class="create">
      <label>名字<input v-model="form.name" maxlength="32" placeholder="她叫什么" /></label>
      <label>一句话简介<input v-model="form.introduction" maxlength="80" placeholder="给别人看的介绍" /></label>
      <label>开场白<textarea v-model="form.kaichangbai" rows="2" placeholder="新对话里的第一句"></textarea></label>
      <label>人设<textarea v-model="form.character" rows="4" placeholder="身份、性格、和你的关系、说话习惯"></textarea></label>
      <label>示例对话<textarea v-model="form.talk" rows="3" placeholder="可选。用户：… / 她：…"></textarea></label>
      <label class="check-row">
        <input v-model="makePublic" type="checkbox" />
        公开到人设广场
      </label>
      <div class="preview-actions">
        <button class="ghost" :disabled="generating" @click="generatePersona">
          {{ generating ? '生成中…' : generated ? '重新生成' : '生成人设' }}
        </button>
        <button class="primary" :disabled="!generated || publishing" @click="enableGenerated">
          {{ publishing ? '启用中…' : '启用' }}
        </button>
      </div>
      <p v-if="generated" class="desc">已生成人设，点启用后开始对话。</p>
    </div>

    <div v-show="tab === 'mine'" class="list">
      <p v-if="loading" class="muted">加载中…</p>
      <button
        v-for="s in skills"
        :key="s.id"
        class="skill"
        :class="{ active: s.active }"
        :disabled="switching"
        :aria-current="s.active ? 'true' : undefined"
        @click="onPick(s)"
      >
        <div class="skill-top">
          <span class="skill-name">{{ s.name }}</span>
          <span v-if="s.builtin" class="badge">内置</span>
          <span v-if="s.active" class="check"><Icon name="check" :size="13" /></span>
        </div>
        <p class="skill-desc">{{ s.description }}</p>
      </button>
      <button
        v-for="card in mine.filter((p) => !skills.some((s) => s.characterId === p.id))"
        :key="card.id"
        class="skill"
        :class="{ active: personaActive(card.id) }"
        :disabled="switching"
        @click="usePersona(card)"
      >
        <div class="skill-top">
          <span class="skill-name">{{ card.name }}</span>
          <span class="badge">我的</span>
          <span v-if="personaActive(card.id)" class="check"><Icon name="check" :size="13" /></span>
        </div>
        <p class="skill-desc">{{ card.introduction || '还没有简介' }}</p>
        <div class="card-actions">
          <button type="button" class="mini" @click="onDelete(card, $event)">删除</button>
        </div>
      </button>
    </div>

    <div v-show="tab === 'plaza'" class="list plaza-list">
      <p v-if="!plaza.length" class="muted">广场还是空的。创建角色时勾选公开，就会出现在这里。</p>
      <article v-for="card in plaza" :key="card.id" class="skill plaza-card" :class="{ active: personaActive(card.id) }">
        <div class="skill-top">
          <span class="skill-name">{{ card.name }}</span>
          <button type="button" class="star" :class="{ on: card.starred }" @click="onStar(card, $event)">
            <Icon name="star" :size="13" />
            {{ card.stars || 0 }}
          </button>
        </div>
        <p class="skill-desc">{{ card.introduction || '还没有简介' }}</p>
        <div class="card-actions">
          <button type="button" class="mini primary" :disabled="switching" @click="usePersona(card)">
            {{ personaActive(card.id) ? '使用中' : '使用' }}
          </button>
        </div>
      </article>
    </div>

    <div v-show="tab === 'memory'" class="list memory-list">
      <p v-if="memoryLoading" class="muted">读取记忆中…</p>
      <p v-else-if="memoryError" class="error">{{ memoryError }}</p>
      <template v-else>
        <p v-if="!memories.length && !communities.length" class="muted">
          还没有长期记忆。聊完后点新对话归档，她才会把这件事记住。
        </p>
        <section v-if="memories.length" class="memory-block">
          <h3>实体记忆</h3>
          <p v-for="(item, i) in memories" :key="i" class="memory-item">{{ item }}</p>
        </section>
        <section v-if="communities.length" class="memory-block">
          <h3>社区记忆</h3>
          <article v-for="(item, i) in communities" :key="i" class="memory-item">
            <strong>{{ item.summary }}</strong>
            <span v-if="item.community_data?.length">{{ item.community_data.join(' · ') }}</span>
          </article>
        </section>
      </template>
    </div>

    <div class="foot">
      <button class="logout" type="button" aria-label="使用指南" @click="emit('guide')">
        <Icon name="book" :size="15" />
        使用指南
      </button>
      <button class="logout" type="button" aria-label="退出登录" @click="emit('logout')">
        <Icon name="logout" :size="15" />
        退出登录
      </button>
      <a
        class="beian"
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
      >浙ICP备2026072556号-1</a>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: var(--radius-lg);
  padding: 18px 16px;
  gap: 14px;
}
.sidebar-head {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--accent-soft);
  border: 1px solid var(--border-strong);
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 24px;
  color: #f6c2d5;
}
.brand h1 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.1;
}
.brand p.user-id {
  max-width: 138px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-faint);
  font-weight: 500;
  letter-spacing: 0.04em;
  margin-top: 3px;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 3px;
  border-radius: var(--radius-sm);
  background: var(--surface-0);
  border: 1px solid var(--border);
}
.tabs button {
  min-height: 32px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-faint);
}
.tabs button.on {
  color: #f6bfd3;
  background: var(--accent-soft);
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.add {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 0 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  border: 1px solid var(--border);
  color: var(--text);
}
.add:hover {
  background: rgba(255, 255, 255, 0.16);
}
.add:disabled {
  opacity: 0.5;
}

.error {
  font-size: 12px;
  color: var(--danger);
  background: rgba(255, 107, 107, 0.1);
  padding: 8px 10px;
  border-radius: 8px;
}

.preview,
.create {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  padding: 12px;
  background: var(--accent-soft);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.create label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-dim);
}
.create input,
.create textarea {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-0);
  color: var(--text);
  padding: 8px 10px;
  font: inherit;
  resize: vertical;
}
.check-row {
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}
.preview-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-dim);
  font-weight: 700;
}
.desc {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  max-height: 84px;
  overflow: auto;
  white-space: pre-wrap;
}
.preview-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.preview-actions button {
  flex: 1;
  height: 32px;
  border-radius: 8px;
  font-size: 13px;
}
.ghost {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  color: var(--text);
}
.primary {
  background: var(--accent-grad);
  color: #fff;
  font-weight: 600;
}
.primary:disabled {
  opacity: 0.5;
}

.list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.skill {
  text-align: left;
  padding: 12px;
  border-radius: 12px;
  background: transparent;
  border: 1px solid transparent;
  transition: all 0.18s;
}
.skill:hover {
  background: var(--surface-1);
}
.skill.active {
  border-color: var(--border-strong);
  background: var(--accent-soft);
}
.skill-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.skill-name {
  font-weight: 600;
  font-size: 14px;
}
.badge {
  font-size: 10px;
  color: var(--text-faint);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 6px;
}
.check {
  margin-left: auto;
  color: var(--accent);
  display: inline-flex;
}
.skill-desc {
  margin-top: 5px;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.mini {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  color: var(--text-dim);
}
.mini.primary {
  color: #fff;
}
.star {
  margin-left: auto;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-faint);
}
.star.on {
  color: var(--gold);
}
.memory-block h3 {
  font-size: 12px;
  color: var(--text-faint);
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
.memory-item {
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-dim);
  padding: 10px;
  border-radius: 10px;
  background: var(--surface-0);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.foot {
  font-size: 11px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.logout {
  width: 100%;
  height: var(--control-h);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-dim);
  border: 1px solid transparent;
  background: var(--surface-0);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.logout:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
}
.muted {
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.55;
}
.beian {
  display: block;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.03em;
  color: var(--text-faint);
  text-decoration: none;
  padding: 4px 0 0;
}
.beian:hover {
  color: var(--text-dim);
}

@media (max-width: 880px) {
  .sidebar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "head foot"
      "error error"
      "preview preview"
      "create create"
      "list list";
    height: auto;
    max-height: 100%;
    padding: max(10px, env(safe-area-inset-top, 0px)) 12px 10px;
    gap: 8px;
    border: 0;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    box-shadow: none;
    background: rgba(17, 11, 20, 0.94);
    overflow: auto;
  }
  .sidebar-head {
    grid-area: head;
    min-width: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .brand {
    min-width: 0;
    flex-shrink: 0;
  }
  .logo {
    width: 40px;
    height: 40px;
  }
  .brand h1 {
    font-size: 20px;
  }
  .brand-copy {
    display: block;
    min-width: 0;
  }
  .brand p.user-id {
    display: none;
  }
  .section-title {
    min-width: 0;
  }
  .section-title span {
    display: none;
  }
  .add {
    min-height: var(--touch-min);
    padding: 0 12px;
  }
  .error {
    grid-area: error;
  }
  .preview {
    grid-area: preview;
  }
  .create {
    grid-area: create;
  }
  .preview-actions button {
    min-height: var(--touch-min);
  }
  .list {
    grid-area: list;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
  }
  .plaza-list,
  .memory-list {
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
    max-height: 58vh;
  }
  .skill {
    min-width: 148px;
    min-height: 52px;
    padding: 8px 10px;
  }
  .skill-desc {
    line-clamp: 1;
    -webkit-line-clamp: 1;
  }
  .foot {
    grid-area: foot;
    flex-shrink: 0;
    flex-direction: row;
    gap: 4px;
  }
  .logout {
    width: var(--touch-min);
    min-width: var(--touch-min);
    padding: 0;
    font-size: 0;
    gap: 0;
  }
  .beian {
    display: none;
  }
}
code {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 5px;
}
</style>
