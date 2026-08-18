## ADDED Requirements

### Requirement: 物料注册计数与门禁一致
物料注册表数量变更时 parity 回归测试的计数断言 SHALL 同步更新；master 上 `pnpm test` MUST 全绿。

#### Scenario: 回归门禁
- **WHEN** 在 packages/ui 执行 `pnpm test`
- **THEN** material-parity 及全部用例通过（当前 39 物料计数一致）

### Requirement: 包名解析对外可用
UI 包内部相互引用 SHALL 使用发布的 scoped 包名（`@luban-low-code/luban-base`），不得使用 npm 上不存在的裸包名；外部消费者安装发布产物后 MUST 可直接解析依赖，无需自行配置 alias。

#### Scenario: 外部消费
- **WHEN** 外部项目 `pnpm add @luban-low-code/luban-low-code` 并 import
- **THEN** 内部对 base 包的引用正常解析，无 `Cannot resolve 'luban-base'` 错误

### Requirement: 代码高亮着色生效
Markdown 与 CodeBlock 物料的语法高亮 SHALL 引入 highlight.js 主题样式，token class 在浏览器中 MUST 呈现颜色差异。

#### Scenario: 高亮可见
- **WHEN** 渲染含代码块的页面
- **THEN** 代码 token 按语言语法着色，非纯背景色

### Requirement: 物料行为与 props schema 一致
物料 propsSchema 中声明的每个属性 MUST 有真实实现效果；声明但不生效的属性（如 BackToTop `duration`）SHALL 实装或从 schema 移除。CodeBlock 的 `maxHeight` 限高时内容 SHALL 可滚动查看，不被裁剪丢失。

#### Scenario: duration 生效或移除
- **WHEN** 属性面板配置 BackToTop 的 duration
- **THEN** 滚动动画时长按配置变化，或该属性不再出现在 schema 中

#### Scenario: 超高代码可滚动
- **WHEN** CodeBlock 内容超过 maxHeight
- **THEN** 容器出现纵向滚动，用户可滚动查看全部代码
