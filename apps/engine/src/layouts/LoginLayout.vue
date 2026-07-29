<script setup lang="ts">
</script>

<template>
  <div class="login-layout">
    <main class="login-layout__main">
      <router-view />
    </main>
  </div>
</template>

<style lang="scss" scoped>
.login-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-layout__main {
  width: 100%;
  max-width: 420px;
  padding: 24px;
}
</style>
