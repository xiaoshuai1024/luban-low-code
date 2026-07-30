# Git 合并/拉取经验（submodule 多仓协作）

> 索引：submodule squash 合并的指针稳定性、PR 合并顺序、本地主仓同步。

---

## 经验：submodule squash 合并后 meta 指针变 dangling

### 场景
多仓协作（meta + 多个 submodule）。engine 子仓在 `feature/luban-ai-assistant-plan1` 分支开发，push 后：
1. engine PR `--squash` 合并到 master，`--delete-branch` 删除 feature 分支
2. meta 仓此前已把 engine 指针指向 feature 分支的 HEAD commit `2c3dbf0`

合并后，meta 仓的 engine 指针 `2c3dbf0` 不在 master 历史里（squash 生成新 commit `a8b169a`），且 feature 分支已删除——`2c3dbf0` 变成 dangling commit（GitHub 会保留约 90 天，之后可能 gc）。

### 根因
squash 合并重写 commit 历史（新 hash），原 feature 分支 HEAD 不进主干。`--delete-branch` 又移除了唯一指向它的 ref。meta 的 submodule 指针指向的是一个"孤儿"commit。

### 解决方案
**合并顺序**：先合 submodule 的 PR，再把 meta 的 submodule 指针**更新到 squash 后的主干 HEAD**，最后合 meta PR。

```bash
# 1. 合 engine PR（squash）→ master 新 HEAD = a8b169a
gh pr merge <num> --repo <engine> --squash --delete-branch

# 2. 在 meta 仓更新 engine 子仓指针到稳定主干 commit
cd apps/engine
git fetch origin master
git checkout master
git reset --hard origin/master   # 现在 HEAD = a8b169a（含 squash 内容）
cd -  # 回 meta
git add apps/engine
git commit -m "chore: engine 指针更新至 master(squash 合并 a8b169a)"
git push                          # 更新 meta PR

# 3. 合 meta PR
gh pr merge <num> --squash --delete-branch
```

### 预防
- **squash 合并 submodule 后，meta 指针必须重新指向主干 HEAD**，不要保留指向 feature 分支 commit 的指针。
- 合并多仓 PR 的顺序：先叶子（submodule），后根（meta）；每合一个 submodule PR，立即更新 meta 指针再合 meta。
- 若已合 meta 但指针是 dangling commit：clone 仍能解析（GitHub 短期保留），但应尽快发 meta PR 把指针修正到主干。
- 判断指针是否稳定：`git -C <submodule> branch -a --contains <指针commit>`，若无任何 ref 包含则危险。

---

## 经验：本地主仓在 feature 分支时如何注册新 submodule

### 场景
main 已合并了新 submodule（如 `packages/ai-assistant`），但本地主仓当前在另一个 feature 分支（有未提交改动），该分支的 `.gitmodules` 和 index 都没有新 submodule 条目。直接 `git submodule update --init` 报 `pathspec did not match`。

### 根因
submodule 的注册由两部分构成：①`.gitmodules` 条目（声明）②index 中的 gitlink（mode 160000 + commit 指针）。feature 分支两者都没有，`git submodule update` 不知道要拉什么。

### 解决方案
从 main 只取这两个文件项到当前分支（不碰其他代码改动）：

```bash
git checkout main -- .gitmodules
git checkout main -- packages/ai-assistant   # 取 gitlink
git submodule update --init packages/ai-assistant
```

之后 `git diff --cached` 只显示 `.gitmodules` + gitlink 两项，单独 commit 即可，不影响 feature 分支的其他工作。

### 预防
- 新 submodule 合入 main 后，各 feature 分支 rebase/merge main 即可自然获得；不必手动 checkout。
- 若 feature 分支不方便 merge main，用上面的 `git checkout main --` 局部取件法（最小侵入）。

---

## 经验：子模块扁平化（submodule → flat monorepo）合并冲突处理

### 场景
需要将子模块（submodule）扁平化为 flat monorepo，但子模块仓库已删除/不可访问（`git ls-remote` 返回 `Repository not found`）。主仓库 master 分支仍持有 `160000 commit` 的 gitlink 条目，需要替换为实打实的文件树。

### 根因
1. 子模块仓库已独立删除（"不再有子仓库了，所有都是 pnpm monorepo"），但 master 分支的 `.gitmodules` 和 index 中的 gitlink 条目仍在。
2. `git submodule deinit -f --all` 只清空工作目录，index 中的 `160000 commit` 条目不变。
3. 从 submodule 切为 flat tree 时，git 将路径类型变更（160000 → 040000）视为 `modify/delete` 冲突。

### 解决方案

**前提**：已有另一个分支（如 `origin/feature/monorepo-migration`）持有扁平化后的文件树。

```bash
# 1. 重置到扁平分支（获得完整 flat 文件树）
git reset --hard origin/feature/monorepo-migration

# 2. 若有额外提交（如 landing page）cherry-pick
git cherry-pick <commit-sha>

# 3. 合并 master 解决冲突（取我们的版本覆盖子模块条目）
git merge origin/master -s recursive -X theirs

# 4. 解决残留冲突
git rm .gitmodules                                    # 删除子模块配置
git rm --cached packages/engine/luban ...             # 删除所有 gitlink 条目

# 5. 提交合并
git commit --no-edit
git push origin HEAD:<branch>
```

**PR 合入后**验证 master 结构：
```bash
# 确认所有子目录是 tree（040000）而非 gitlink（160000）
git ls-tree origin/master packages/
# 确认 .gitmodules 不存在
git cat-file -e origin/master:.gitmodules && echo "EXISTS" || echo "ABSENT"
```

### 预防
- 子模块仓库删除前，确保有分支持有扁平后的文件树（如 `feature/monorepo-migration`）。
- 扁平化后用 `git merge -s recursive -X theirs` 处理 modify/delete 冲突，不要手动逐个解。
- PR 合并前先 `git merge base-branch` 本地测试，确认没有突。
- `.claude/worktrees/` 等 agent 工作目录通过 `.gitignore` 排除并 `git rm --cached` 清理。
