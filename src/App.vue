<script setup>
import { ref, computed } from 'vue'
import SkillSidebar from './components/SkillSidebar.vue'
import Live2DStage from './components/Live2DStage.vue'
import AgentPanel from './components/AgentPanel.vue'
import ChatPanel from './components/ChatPanel.vue'
import LoginGate from './components/LoginGate.vue'
import { useAuth } from './composables/useAuth.js'

const speaking = ref(false)
const activeSkill = ref({ id: 'hh', name: '明日香' })
const middleMode = ref('companion') // companion | agent

const { isLoggedIn, currentSessionId, logout } = useAuth()

// 用户 session_id（记忆/数据隔离）；与 Skill 人设 id 分开
const sessionId = computed(() => currentSessionId.value)

function onActivate(skill) {
  activeSkill.value = skill
  // 不再用 skill.id 覆盖用户 session_id
}
</script>

<template>
  <LoginGate v-if="!isLoggedIn" @success="() => {}" />

  <div v-else class="app">
    <SkillSidebar
      class="col-skill"
      :session-id="sessionId"
      @activate="onActivate"
      @logout="logout"
    />

    <main class="col-stage glass">
      <div class="mode-switch">
        <button
          :class="{ on: middleMode === 'companion' }"
          @click="middleMode = 'companion'"
        >
          陪伴
        </button>
        <button
          :class="{ on: middleMode === 'agent' }"
          @click="middleMode = 'agent'"
        >
          生产力
        </button>
      </div>

      <Live2DStage
        v-show="middleMode === 'companion'"
        :speaking="speaking"
        :name="activeSkill.name"
      />
      <AgentPanel v-show="middleMode === 'agent'" :session-id="sessionId" />
    </main>

    <section class="col-chat">
      <ChatPanel :session-id="sessionId" @speaking="(v) => (speaking = v)" />
    </section>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  width: 100vw;
  display: grid;
  grid-template-columns: 280px 1fr 420px;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
  box-sizing: border-box;
}
.col-skill {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.col-stage {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
.mode-switch {
  position: absolute;
  z-index: 5;
  top: 14px;
  left: 14px;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}
.mode-switch button {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  transition: color 0.18s, background 0.18s;
}
.mode-switch button.on {
  color: #fff;
  background: var(--accent-grad);
}
.col-chat {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (max-width: 1100px) {
  .app {
    grid-template-columns: 240px 1fr 360px;
  }
}
@media (max-width: 880px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: auto 240px 1fr;
    height: 100vh;
    min-height: 0;
    overflow: hidden;
  }
  .col-chat {
    min-height: 0;
  }
}
</style>
