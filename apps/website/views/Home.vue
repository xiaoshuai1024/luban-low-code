<script setup lang="ts">
/**
 * Home — redirects to the Luban-built homepage at /{defaultSlug}/.
 * The actual homepage is a Luban PageSchema stored in MySQL,
 * built through the visual builder at http://192.168.100.248:4200.
 * No hand-written page code allowed.
 */
import { DEFAULT_SITE_SLUG } from "~/utils/routes";

const config = useRuntimeConfig().public;
const defaultSlug = (config.defaultSiteSlug as string) || DEFAULT_SITE_SLUG;

await navigateTo(`/${defaultSlug}/`, { replace: true });
</script>

<template>
  <div class="loading">Redirecting...</div>
</template>

<style scoped>
.loading { padding: 2rem; text-align: center; }
</style>
