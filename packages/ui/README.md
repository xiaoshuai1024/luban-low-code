# LubanUI

<p align="center">
  <img src="https://img.shields.io/npm/v/luban-base.svg" alt="npm version">
  <img src="https://img.shields.io/npm/v/luban-low-code.svg" alt="npm version">
  <img src="https://img.shields.io/github/license/luban-ui/luban-ui.svg" alt="license">
  <a href="https://nx.dev"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="30" alt="Nx"></a>
</p>

LubanUI 是一个基于 Vue 3 的低代码平台核心组件库，提供基础组件、低代码运行时和可视化设计器能力。

## 特性

- **Material Design** - 遵循 Google Material Design 设计规范
- **响应式** - 适配多种屏幕尺寸
- **类型安全** - 完整的 TypeScript 类型声明
- **可扩展** - 灵活的自定义组件机制
- **可视化设计** - 支持拖拽式页面构建

## 包结构

| 包                                          | 说明                                     |
| ------------------------------------------- | ---------------------------------------- |
| [luban-base](./packages/luban-base)         | 基础 UI 组件库（按钮、输入框、选择器等） |
| [luban-low-code](./packages/luban-low-code) | 低代码运行时与可视化设计器               |
| [luban-utils](./packages/luban-utils)       | 工具函数与通用逻辑                       |

## 快速开始

### 安装

```bash
# 安装基础组件库
pnpm add luban-base

# 或者安装低代码组件库（包含基础组件）
pnpm add luban-low-code
```

### 使用基础组件

```vue
<template>
  <luban-button type="primary" @click="handleClick"> 提交 </luban-button>
</template>

<script setup>
import { LubanButton } from 'luban-base';

const handleClick = () => {
  console.log('clicked');
};
</script>
```

### 使用低代码运行时

```vue
<template>
  <LubanPage :schema="schema" />
</template>

<script setup>
import { LubanPage } from 'luban-low-code';
import type { PageSchema } from 'luban-low-code';

const schema = {
  root: {
    id: 'root',
    type: 'LubanContainer',
    props: {},
    children: []
  },
  formState: {}
};
</script>
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 启动 Storybook
pnpm storybook

# 运行测试
pnpm test

# 运行 e2e 测试
pnpm test:e2e

# 构建所有包
pnpm exec nx run-many --target=build --projects=luban-base,luban-low-code
```

## 项目结构

```
luban-ui/
├── apps/
│   └── luban-ui/           # Demo 应用
├── packages/
│   ├── luban-base/        # 基础组件库
│   ├── luban-low-code/    # 低代码组件库
│   └── luban-utils/       # 工具函数库
├── docs/                   # 项目文档
└── nx.json                # Nx 配置
```

## 贡献

欢迎提交 Issue 和 Pull Request。请先阅读 [贡献指南](./CONTRIBUTING.md)。

## 许可证

MIT License - 见 [LICENSE](./LICENSE) 文件。
