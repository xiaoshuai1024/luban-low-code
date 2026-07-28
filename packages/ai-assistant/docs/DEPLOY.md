# luban-ai-assistant 部署文档（测试服务器）

> 本文档对应 plan P1-T10。目标：在测试服务器用 docker compose 一键拉起 6 容器 + 初始化资源，
> engine 前端经 vite 代理直连 AI 服务。

## 前置

- 测试服务器已装 Docker + Docker Compose
- SSH 凭证存仓库根 `.env.dev`（已 gitignore，不入仓）：
  ```
  DEPLOY_SSH_HOST=10.x.x.x
  DEPLOY_SSH_USER=deploy
  DEPLOY_SSH_PORT=22
  DEPLOY_SSH_KEY=/path/to/key        # 或 DEPLOY_SSH_PASS=...
  DEPLOY_REMOTE_DIR=/opt/luban-ai-assistant
  ```
- 远程服务器先放置 `.env`（含真实 LLM key / JWT secret / Langfuse key），**不入仓**

## 部署步骤

### 1. 推送到测试服务器

在仓库根（已 `source .env.dev`）：

```bash
source .env.dev
bash packages/ai/luban-ai-assistant/deploy/deploy.sh
```

`deploy.sh` 会：
- rsync 推送 compose + 服务代码（排除 .env/.git/__pycache__）
- 远程 `docker compose config -q` 校验
- `docker compose build && up -d --wait`（6 容器健康）
- `docker compose exec fastapi bash deploy/init.sh`（幂等建库/collection/bucket）
- 远程 `curl /healthz` 健康检查

### 2. 验证 6 容器健康

```bash
ssh deploy@<host>
cd /opt/luban-ai-assistant
docker compose ps              # 全部 Up (healthy)
curl -s http://localhost:8000/healthz | jq .
# 期望 {"status":"ok","deps":{"postgres":true,"milvus":true,"minio":true,"langfuse":true}}
```

### 3. 物料知识同步（RAG 入库）

```bash
# 从 luban-ui materialRegistry 导出物料，同步到 Milvus（幂等可重跑）
docker compose exec fastapi python -m app.rag.sync_materials_cli
```

> P1 物料导出脚本：从 luban-ui `materialRegistry.getAll()` 取 name/category/description/propsSchema，
> 经 sync_materials.MaterialSyncer 入库。

## 模型切换（GLM/DeepSeek/通义）

改远程 `.env` 的 `MODEL_PROVIDER` 一行：

```bash
# GLM（默认）
MODEL_PROVIDER=glm
GLM_API_KEY=<your-glm-key>

# DeepSeek
MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=<your-ds-key>

# 通义千问
MODEL_PROVIDER=tongyi
QWEN_API_KEY=<your-qwen-key>
```

重启生效：

```bash
docker compose restart fastapi
curl -s http://localhost:8000/ai/config | jq .   # 确认 provider 切换
```

## 三家模型冒烟测试

需配真实 key。在 AI 服务目录（或容器内）：

```bash
# 单个 provider 冒烟
MODEL_PROVIDER=glm GLM_API_KEY=<key> uv run pytest tests/smoke/test_smoke.py -m smoke -k glm
MODEL_PROVIDER=deepseek DEEPSEEK_API_KEY=<key> uv run pytest tests/smoke/test_smoke.py -m smoke -k deepseek
MODEL_PROVIDER=tongyi QWEN_API_KEY=<key> uv run pytest tests/smoke/test_smoke.py -m smoke -k tongyi
```

冒烟测试用真实 API（标记 `@pytest.mark.smoke`，默认不在 CI 跑）。

## engine 前端联调

engine vite dev 已配代理 `/ai-proxy → http://localhost:8000`：

```bash
cd packages/engine/luban
pnpm dev    # 默认 5173
# 打开 /sites/:siteId/pages/:pageId/edit，右侧 AI 助手面板
```

生产部署：engine 构建后经反向代理把 `/ai-proxy/*` 转发到 AI 服务 `:8000`。

## 回滚

- AI 面板异常 → 关 engine FeatureGate `VITE_FEATURE_AI_ASSISTANT_ENABLED=false`（编辑器回归原状，**首选**）
- AI 服务故障 → 关 `AI_GENERATE_ENABLED=false` / `AI_GUIDANCE_ENABLED=false`，面板提示功能未启用
- provider 故障 → `MODEL_PROVIDER` 回退上一可用模型
- Milvus/MinIO 故障 → RAG 降级（agent 用全量物料 prompt 兜底）

## 故障排查

| 症状 | 排查 |
|------|------|
| `/healthz` deps 全 false | 容器未起齐，`docker compose ps` 看状态，`docker compose logs milvus` |
| AI 面板 401 | engine JWT 与 AI 服务 `AUTH_JWT_SECRET` 不一致；确认两端密钥相同 |
| 生成失败回环超限 | 看 `docker compose logs fastapi`，多为 LLM 产非法 schema；校验闸拒绝 |
| Milvus collection 缺失 | 重跑 `bash deploy/init.sh`（幂等） |
