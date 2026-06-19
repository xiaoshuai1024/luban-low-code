# luban-ai-assistant

Luban AI 助手 — 自然语言生成/编辑页面 + 引导 + 模型切换。

详见计划 `.agents/plans/2026-06-19-luban-ai-assistant-plan1.md`。

## 技术栈
Python 3.12 + uv · FastAPI(SSE+WS) · LangGraph(状态图+checkpoint+HITL) ·
LangChain ChatModel + provider 适配层（智谱/DeepSeek/通义）· instructor+Pydantic v2 ·
Milvus + 云端 embedding（hybrid 检索）· MinIO · etcd · PostgreSQL · Langfuse（自托管）。

## 开发

```bash
cp .env.example .env          # 填入真实 key（不入仓）
uv sync                       # 装依赖
uv run pytest --cov --cov-fail-under=85
uv run ruff check && uv run mypy app
uv run uvicorn app.main:app --reload
```

## 容器（6 容器，无 GPU）

```bash
docker compose up -d --wait
docker compose exec fastapi bash deploy/init.sh   # 建库/collection/bucket（幂等）
curl localhost:8000/healthz
```

## 部署（测试服务器）

SSH 凭证从仓库根 `.env.dev` 注入（禁硬编码明文，已 gitignore）：

```bash
source .env.dev
bash packages/ai/luban-ai-assistant/deploy/deploy.sh
```
