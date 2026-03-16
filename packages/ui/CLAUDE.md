# 系统约束
- 这是低代码平台的其中一个项目，他和其他的项目在同一个目录下 

# 设计约束
- 所有的组件风格遵守Google google material design
- 所有的组件都是响应式设计，可以在多个尺寸的屏幕进行展示

# 功能
- 这是低代码平台的底层组件库
- 这个组件库会被集成到其他的项目中

# 架构约束
- 每个组件都要生成ts类型声明
- 使用nx来管理所有的组件库
- 组件使用vue3风格，调用nx进行创建
- 每个组件都要有**单元测试和 e2e 测试**：基础组件、低代码组件、工具函数在新增/修改时必须同时补齐对应的 Vitest 单元测试和 Cypress / Vitest e2e 用例，并确保通过根目录脚本（pnpm test / pnpm test:e2e / pnpm test:base:e2e / pnpm test:lowcode:e2e）可以执行
  - 包内测试目录规范：统一为 `packages/<pkg-name>/test`，其下再按 `unit/` 与 `e2e/` 分目录；
  - **每个组件/模块一个测试文件**：例如 `packages/luban-base/test/unit/button.spec.ts`、`.../form.spec.ts`、`packages/luban-low-code/test/e2e/designer.e2e.spec.ts`，禁止将多个组件的测试堆在同一个大文件里，保证测试粒度清晰、易维护。
- packages/luban-base 是基础组件，如按钮，输入框
- pakcages/luban-low-code是低代码组件，通过基础组件来开发，可以用在后台进行拖拽
- packages/luban-utils是工具组件和通用函数
- **包命名与引用规范**：
  - 对外发布到 npm 的包使用无 scope 的正式包名：`luban-base`、`luban-low-code`、`luban-utils`。
  - 在本仓库内部开发时，可以通过 Vite alias 使用 `@luban-ui/luban-base`、`@luban-ui/luban-low-code`、`@luban-ui/luban-utils` 这类别名方便引用源码（如 apps/luban-ui 内），但对外文档与生产项目一律使用 npm 包名。
  - low-code 包内部（打包产物）只能通过正式 npm 包名依赖基础包（例如 `import { … } from 'luban-base'`，并在 Rollup external 中将 `'luban-base'` 标记为外部依赖），禁止使用 workspace:* 或别名形式写入已发布包的 `package.json`。
  - 独立后台工程（如 `luban` 仓库）通过 `pnpm add luban-low-code` 使用设计器能力，不再依赖 `@luban-ui/*` scope。
- **Demo 代码仅放在应用层**：所有 demo 页面、默认 schema、示例数据等只允许放在 apps/*（如 apps/luban-ui），不得放入 packages 下的组件库代码中；组件库只提供通用组件与运行时，由应用负责组装与演示。
- **设计器依赖由 low-code 包管理**：设计器相关依赖（如 sortablejs）只作为 packages/luban-low-code 的依赖；使用设计器的 demo 或应用仅通过 @luban-ui/luban-low-code 的 API（LubanDesigner、reorderRootChildren 等）使用能力，不得在 apps 或业务中直接 import sortablejs 等设计器实现依赖。
- **设计器拖拽行为不变量**：
  - 在 designMode 下，画布背景区域始终可从组件面板拖入组件，任何改动不得破坏「拖到画布即可新增根级节点」的行为。
  - 对于被标记为容器的组件（如 LubanContainer、LubanRow、LubanCol、LubanForm），其内部始终存在可拖入子组件的 drop 区域，且只通过 @luban-ui/luban-low-code 暴露的 API 与 schema 修改进行数据更新，不依赖浏览器插件或额外脚本。
- **Vue 模板组件调用风格**：在 .vue 的 template 中，统一使用 kebab-case 标签名调用组件（例如 `<luban-form>` 而不是 `<LubanForm>`，`<luban-designer>` 而不是 `<LubanDesigner>`），无论组件在脚本中如何命名导入，保持模板层标签风格一致、可读。
- 组件命名简短、可读，不包含 Field 等冗余后缀（如 LubanInput、LubanSelect、LubanCheckbox）
- 组件样式使用 SASS（.scss）编写；与主题相关的颜色、间距、圆角、阴影、断点等提取到单独的变量文件（如 _variables.scss），便于后期主题功能开发
- 组件内容使用 Vue 的 template 编写（单文件组件 .vue），不使用 h() 作为主要实现方式

# github
- commit message使用Google风格

# storybook
- 使用左右布局，左侧是按照组件库及组件库下组件的列表，右侧是当前打开的组件内容

# 输出
- 任务结束后不要输出summary
- 用户要求修改代码时，**直接在仓库中改代码并解释关键点，不再让用户手动去改配置或代码片段**

# 权限与安全约束
- **禁止通过用户名等方式 Hack 权限**：鉴权与授权必须严格依赖明确的角色字段（如 role==='admin'），不得通过 username==='admin' 之类的逻辑来“猜测”权限，更不得在 BFF 层强行篡改角色以绕过后端校验。任何权限判断都应以后端的真实用户数据和角色模型为准，并通过 JWT / Header 等标准方式传递。

# 代码提交规范
@docs/COMMIT.md