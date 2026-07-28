<script setup lang="ts">
import { homePath, DEFAULT_SITE_SLUG } from "~/utils/routes";

const config = useRuntimeConfig().public;
const defaultSlug = (config.defaultSiteSlug as string) || DEFAULT_SITE_SLUG;

await navigateTo(homePath(defaultSlug), { replace: true });
</script>

<template>
  <div class="loading">Redirecting...</div>
</template>

<style scoped>
.loading {
  padding: 2rem;
  text-align: center;
}
</style>
