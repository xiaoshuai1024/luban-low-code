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
- 每个组件都要有单元测试、e2e测试和创建story book
- packages/luban-base 是基础组件，如按钮，输入框
- pakcages/luban-low-code是低代码组件，通过基础组件来开发，可以用在后台进行拖拽
- packages/luban-utils是工具组件和通用函数
- 以上几个package都用过别名来访问
- **Demo 代码仅放在应用层**：所有 demo 页面、默认 schema、示例数据等只允许放在 apps/*（如 apps/luban-ui），不得放入 packages 下的组件库代码中；组件库只提供通用组件与运行时，由应用负责组装与演示。
- 组件命名简短、可读，不包含 Field 等冗余后缀（如 LubanInput、LubanSelect、LubanCheckbox）
- 组件样式使用 SASS（.scss）编写；与主题相关的颜色、间距、圆角、阴影、断点等提取到单独的变量文件（如 _variables.scss），便于后期主题功能开发
- 组件内容使用 Vue 的 template 编写（单文件组件 .vue），不使用 h() 作为主要实现方式

# github
- commit message使用Google风格

# storybook
- 使用左右布局，左侧是按照组件库及组件库下组件的列表，右侧是当前打开的组件内容

# 输出
- 任务结束后不要输出summary