<script setup>
import { ref, onMounted, watch } from 'vue'
import { listSkills, uploadSkill } from '../api/index.js'
import { parseFrontmatter } from '../utils/frontmatter.js'
import { skillDisplayName } from '../utils/skillName.js'
import Icon from './Icon.vue'

const props = defineProps({
  sessionId: { type: String, default: '' },
})
const emit = defineEmits(['activate', 'logout', 'guide'])

const skills = ref([])
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const fileInput = ref(null)
const preview = ref(null) // 上传前的解析预览

async function refreshSkills() {
  if (!props.sessionId) {
    skills.value = []
    return
  }
  const list = await listSkills(props.sessionId)
  skills.value = list.map((s) => ({ ...s, name: skillDisplayName(s) }))
  const active = list.find((s) => s.active) || list[0]
  if (active) emit('activate', active)
}

onMounted(async () => {
  try {
    await refreshSkills()
  } catch (e) {
    error.value = '加载人设失败：' + (e.message || e)
    skills.value = []
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
    skills.value = [
      {
        id: saved.id || props.sessionId,
        name: skillDisplayName({ ...saved, name: saved.name || preview.value.name }),
        description: saved.description || preview.value.description,
        active: true,
        builtin: false,
      },
    ]
    activate(skills.value[0].id)
    preview.value = null
  } catch (e) {
    error.value = '上传失败：' + e.message
  } finally {
    uploading.value = false
  }
}

function activate(id) {
  skills.value = skills.value.map((s) => ({ ...s, active: s.id === id }))
  const s = skills.value.find((x) => x.id === id)
  if (s) emit('activate', s)
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

      <div class="section-title">
        <span>我的角色</span>
        <button class="add" :disabled="uploading" @click="pickFile">
          <Icon name="plus" :size="14" />
          导入角色
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

    <!-- 上传预览确认 -->
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

    <div class="list">
      <p v-if="loading" class="muted">加载中…</p>
      <p v-else-if="!skills.length" class="muted">还没有专属伽拉忒亚。上传一份人设，或先和明日香聊。</p>
      <button
        v-for="s in skills"
        :key="s.id"
        class="skill"
        :class="{ active: s.active }"
        :aria-current="s.active ? 'true' : undefined"
        @click="activate(s.id)"
      >
        <div class="skill-top">
          <span class="skill-name">{{ s.name }}</span>
          <span v-if="s.builtin" class="badge">内置</span>
          <span v-if="s.active" class="check"><Icon name="check" :size="13" /></span>
        </div>
        <p class="skill-desc">{{ s.description }}</p>
      </button>
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

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.add {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 0 11px;
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

.preview {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  padding: 12px;
  background: var(--accent-soft);
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
      "list list";
    height: auto;
    padding: max(10px, env(safe-area-inset-top, 0px)) 12px 10px;
    gap: 8px;
    border: 0;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    box-shadow: none;
    background: rgba(17, 11, 20, 0.94);
  }
  .sidebar-head {
    grid-area: head;
    min-width: 0;
    flex-direction: row;
    align-items: center;
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
