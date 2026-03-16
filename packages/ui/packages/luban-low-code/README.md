# luban-low-code

Low-code runtime and designer for Vue 3: render from JSON schema and optional drag-and-drop design surface.

## Installation

Install this package; it will pull `@luban-ui/luban-base` and `vue` as dependencies. No need to install the base package separately.

```bash
pnpm add @luban-ui/luban-low-code
```

## Render from JSON

Pass a `PageSchema` (tree of `NodeSchema` + optional `formState`) to render the page:

```vue
<template>
  <LubanPage :schema="schema" />
</template>
<script setup>
import { LubanPage } from '@luban-ui/luban-low-code';
import type { PageSchema } from '@luban-ui/luban-low-code';

const schema = { root: { id: 'root', type: 'LubanContainer', props: {}, children: [] }, formState: {} };
</script>
```

Or use `RuntimeRenderer` directly with `root` and `formState` for more control.

## Building

Run `nx build luban-low-code` to build the library.

## Running unit tests

Run `nx test luban-low-code` to execute the unit tests via [Vitest](https://vitest.dev/).
