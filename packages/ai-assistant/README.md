# luban-ai-assistant

Luban AI 助手 — 自然语言生成/编辑页面 + 引导 + 模型切换（迁移演进中）。

详见计划 `.agents/plans/2026-06-28-luban-ai-assistant-2026.md`。

## 技术栈
Python 3.12 + uv · FastAPI(SSE+WS) · LangGraph(状态图+checkpoint+HITL) ·
LiteLLM SDK（DeepSeek 首选，可切 GLM/通义，去 instructor）· Pydantic v2 ·
Qdrant + 云端 embedding（hybrid 检索）· PostgreSQL。

> 迁移说明：原 Milvus+MinIO+etcd+Langfuse 已替换为 Qdrant（精简为 3 容器）。

## 开发

```bash
cp .env.example .env          # 填入真实 key（不入仓）
uv sync                       # 装依赖
uv run pytest --cov --cov-fail-under=85
uv run ruff check && uv run mypy app
uv run uvicorn app.main:app --reload
```

## 容器（3 容器，无 GPU）

```bash
docker compose up -d --wait
docker compose exec fastapi bash deploy/init.sh   # 建库/collection（幂等）
curl localhost:8000/healthz
```

## 部署（测试服务器）

SSH 凭证从仓库根 `.env.dev` 注入（禁硬编码明文，已 gitignore）：

```bash
source .env.dev
bash packages/ai/luban-ai-assistant/deploy/deploy.sh
```
