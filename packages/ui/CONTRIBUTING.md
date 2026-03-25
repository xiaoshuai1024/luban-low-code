# 贡献指南

感谢您对 LubanUI 项目的兴趣！我们欢迎任何形式的贡献，包括但不限于报告问题、提交功能请求、修复 bug 或改进文档。

## 开发环境设置

### 前置要求

- Node.js 18+
- pnpm 8+
- Git

### 本地开发

1. 克隆仓库

```bash
git clone https://github.com/luban-ui/luban-ui.git
cd luban-ui
```

2. 安装依赖

```bash
pnpm install
```

3. 启动开发服务器

```bash
pnpm dev
```

4. 启动 Storybook（查看组件文档）

```bash
pnpm storybook
```

## 代码规范

### Git 提交规范

本项目采用 [Google 风格提交规范](./docs/COMMIT.md)：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**类型说明：**

| type       | 说明                   |
| ---------- | ---------------------- |
| `feat`     | 新功能                 |
| `fix`      | 修复缺陷               |
| `docs`     | 仅文档变更             |
| `style`    | 代码风格（不影响逻辑） |
| `refactor` | 重构                   |
| `perf`     | 性能优化               |
| `test`     | 测试相关               |
| `chore`    | 构建/工具/依赖等维护   |

**示例：**

```bash
# 功能
feat(luban-base): add LubanSwitch component

# 修复
fix(runtime): bind v-model for select options

# 文档
docs(readme): update installation instructions
```

### 代码风格

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 遵循 Vue 3 组件最佳实践

运行 lint 检查：

```bash
# 整个项目
pnpm exec nx run-many --target=lint

# 单个包
pnpm exec nx lint luban-base
```

## 测试要求

所有新增或修改的代码必须包含对应的测试：

### 单元测试

- 使用 Vitest 编写单元测试
- 测试文件放在 `packages/<pkg-name>/test/unit/` 目录
- 每个组件对应一个测试文件（如 `button.spec.ts`）

运行单元测试：

```bash
# 所有包
pnpm test

# 特定包
pnpm test:base    # luban-base
pnpm test:lowcode # luban-low-code
```

### E2E 测试

- 使用 Vitest/Cypress 编写 E2E 测试
- 测试文件放在 `packages/<pkg-name>/test/e2e/` 目录

运行 E2E 测试：

```bash
pnpm test:e2e     # 应用层 e2e
pnpm test:base:e2e   # 基础组件 e2e
pnpm test:lowcode:e2e # 低代码组件 e2e
```

### 测试覆盖率

确保新代码的测试覆盖率不低于项目平均水平。

## 创建新组件

### 1. 使用 Nx 生成组件

```bash
# 创建基础组件
npx nx g @nx/vue:component LubanButton --project=luban-base --directory=src/lib/button

# 创建低代码组件
npx nx g @nx/vue:component LubanContainer --project=luban-low-code --directory=src/lib/container
```

### 2. 实现组件

- 使用 Vue 3 Composition API
- 使用 SASS 编写样式（参考 `_variables.scss`）
- 组件名使用 PascalCase（如 `LubanButton`）
- 模板中使用 kebab-case 标签（如 `<luban-button>`）

### 3. 添加类型声明

使用 `vite-plugin-dts` 自动生成类型声明文件。

### 4. 编写测试

- 单元测试：`test/unit/<component-name>.spec.ts`
- E2E 测试：`test/e2e/<component-name>.e2e.spec.ts`

### 5. 添加 Storybook 文档

在组件目录创建 `.stories.ts` 文件：

```typescript
import type { Meta, StoryObj } from '@storybook/vue3';
import LubanButton from './luban-button.vue';

const meta: Meta<typeof LubanButton> = {
  component: LubanButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LubanButton>;

export const Primary: Story = {
  args: {
    type: 'primary',
    label: 'Button',
  },
};
```

## Pull Request 流程

1. **Fork** 本仓库，创建特性分支
2. **开发** 您的功能或修复
3. **测试** 确保所有测试通过
4. **提交** 遵循提交规范
5. **推送** 并创建 Pull Request
6. **审查** 等待代码审查和反馈

### PR 标题规范

使用与提交信息相同的格式：

```
feat(luban-base): add new component
fix(luban-low-code): correct binding issue
```

## 问题反馈

请使用 [GitHub Issues](https://github.com/luban-ui/luban-ui/issues) 报告问题：

- **Bug 报告**：提供复现步骤、环境信息
- **功能请求**：描述使用场景和预期行为
- **问题咨询**：详细说明问题和疑问

## 许可证

通过贡献代码，您同意将您的贡献按 [MIT](./LICENSE) 许可证发布。
