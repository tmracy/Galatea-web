<script setup>
import { ref, onMounted, watch } from 'vue'
import { listSkills, uploadSkill } from '../api/index.js'
import { parseFrontmatter } from '../utils/frontmatter.js'

const props = defineProps({
  sessionId: { type: String, default: '' },
})
const emit = defineEmits(['activate', 'logout'])

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
  skills.value = list
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
        name: saved.name || preview.value.name,
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
    <div class="brand">
      <div class="logo">G</div>
      <div>
        <h1>Galatea</h1>
        <p class="user-id">用户：{{ sessionId }}</p>
      </div>
    </div>

    <div class="section-title">
      <span>人设</span>
      <button class="add" :disabled="uploading" @click="pickFile">＋ 上传</button>
      <input
        ref="fileInput"
        type="file"
        accept=".md,text/markdown"
        hidden
        @change="onFile"
      />
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
      <p v-else-if="!skills.length" class="muted">暂无人设。默认明日香会在首次聊天时自动就绪，也可点「上传」自定义 skill.md。</p>
      <button
        v-for="s in skills"
        :key="s.id"
        class="skill"
        :class="{ active: s.active }"
        @click="activate(s.id)"
      >
        <div class="skill-top">
          <span class="skill-name">{{ s.name }}</span>
          <span v-if="s.builtin" class="badge">内置</span>
          <span v-if="s.active" class="check">●</span>
        </div>
        <p class="skill-desc">{{ s.description }}</p>
      </button>
    </div>

    <div class="foot">
      <button class="logout" type="button" @click="emit('logout')">退出登录</button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: var(--radius);
  padding: 18px;
  gap: 16px;
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
  background: var(--accent-grad);
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 22px;
  color: #fff;
}
.brand h1 {
  font-size: 18px;
}
.brand p.user-id {
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
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
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
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
  border: 1px dashed var(--accent-2);
  border-radius: 12px;
  padding: 12px;
  background: rgba(167, 139, 250, 0.08);
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
  background: var(--accent-2);
  color: #fff;
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  transition: all 0.18s;
}
.skill:hover {
  background: rgba(255, 255, 255, 0.1);
}
.skill.active {
  border-color: var(--accent);
  background: rgba(255, 143, 177, 0.12);
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
  font-size: 10px;
}
.skill-desc {
  margin-top: 5px;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  display: -webkit-box;
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
  height: 36px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-dim);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
}
.logout:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
}
.muted {
  color: var(--text-faint);
  font-size: 12px;
}
code {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 5px;
}
</style>
