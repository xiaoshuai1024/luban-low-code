# 提交规范（Google 风格）

本仓库采用 **Google 风格** 的 Git 提交信息规范，便于历史追溯、自动生成 CHANGELOG 与版本号。

---

## 1. 基本格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

- **第一行**：必填，简短摘要。
- **空行**：摘要与正文之间保留一行空行。
- **正文**：选填，说明「做了什么」与「为什么」。
- **脚注**：选填，如关联 issue、破坏性变更说明。

---

## 2. 第一行规则

### 2.1 类型（type）

使用小写，且为下列之一：

| type     | 说明           |
|----------|----------------|
| `feat`   | 新功能         |
| `fix`    | 修复缺陷       |
| `docs`   | 仅文档变更     |
| `style`  | 代码风格（不影响逻辑，如格式、分号） |
| `refactor` | 重构（既非修 bug 也非新功能） |
| `perf`   | 性能优化       |
| `test`   | 测试相关       |
| `chore`  | 构建/工具/依赖等维护 |
| `build`  | 构建系统或外部依赖变更 |

### 2.2 范围（scope）

选填，表示影响范围，如包名或模块：

- `feat(luban-base): add LubanSwitch`
- `fix(luban-low-code): correct formState binding`
- `chore(nx|package): init packages and nx config`

### 2.3 主题（subject）

- **祈使句、现在时**：用 "Add" 而不是 "Added" 或 "Adds"。
- **首字母大写**，结尾**不加句号**。
- **尽量简短**：建议 50 字符以内，便于在列表与工具中展示；单行不宜超过 72 字符。

**推荐：**

- `feat(form): add LubanSwitch component`
- `fix(runtime): bind v-model for select options`

**不推荐：**

- `Fixed the bug`（应用 "Fix the bug"）
- `add switch.`（结尾不要句号）

---

## 3. 正文（body）

- 与第一行之间**空一行**。
- 说明**改动内容**与**动机**，必要时可多段。
- 每行建议在约 **72 字符**处换行，便于在终端中阅读。

---

## 4. 脚注（footer）

- 与正文之间**空一行**。
- 常用写法：
  - 关联 issue：`Fixes #123`、`Closes #456`
  - 破坏性变更：以 `BREAKING CHANGE:` 开头，说明影响与迁移方式。

---

## 5. 破坏性变更

在 type 后加 `!`，或在 footer 中写 `BREAKING CHANGE:`：

```
feat(api)!: change getComponent to async

BREAKING CHANGE: getComponent now returns Promise<Component>.
```

---

## 6. 示例

**仅摘要：**

```
feat(luban-base): add LubanSwitch to form components
```

**带正文：**

```
fix(runtime): bind formState by node name

RuntimeRenderer was not passing modelValue for LubanSelect.
Form value components now read/write formState using props.name.
```

**带脚注：**

```
fix(registry): resolve LubanButton in designer

Fixes #42
```

**本仓库已有示例：**

```
chore(nx|package): init packages and nx config
```

---

## 7. 参考

- [Google Open Source - Commit Message Format](https://google.github.io/eng-practices/review/developer/cl-description.html)
- [Conventional Commits](https://www.conventionalcommits.org/)
