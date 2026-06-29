<script setup>
import { ref, computed } from 'vue'
import SkillSidebar from './components/SkillSidebar.vue'
import Live2DStage from './components/Live2DStage.vue'
import ChatPanel from './components/ChatPanel.vue'
import LoginGate from './components/LoginGate.vue'
import { useAuth } from './composables/useAuth.js'

const speaking = ref(false)
const activeSkill = ref({ id: 'hh', name: '张蕊' })

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
      <Live2DStage :speaking="speaking" :name="activeSkill.name" />
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
  border-radius: var(--radius);
  overflow: hidden;
  min-width: 0;
  min-height: 0;
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
