"""会话 checkpoint：持久化 AgentState 到 PostgreSQL，会话可恢复。

多租户隔离（MUST）：按 user_id 隔离，A 用户不可见 B 会话。

抽象 CheckpointStore：内存实现（单测）+ Postgres 实现（生产）。
agent 不直接依赖 LangGraph langgraph-checkpoint-postgres（那是 graph 级别），
这里存的是业务会话状态（ai_sessions 表 + AgentState JSON）。
"""

from __future__ import annotations

import abc
import json
import uuid
from typing import Any

from app.agent.state import AgentState, SessionStatus
from app.core.config import Settings


class CheckpointError(Exception):
    """checkpoint 操作失败。"""


class CheckpointStore(abc.ABC):
    """会话状态存储抽象。"""

    @abc.abstractmethod
    async def save(self, state: AgentState) -> None:
        """保存/更新会话状态（按 session_id 幂等）。"""

    @abc.abstractmethod
    async def load(self, session_id: str, user_id: str) -> AgentState | None:
        """加载会话（按 user_id 隔离：非本人返回 None）。"""

    @abc.abstractmethod
    async def update_status(
        self, session_id: str, user_id: str, status: SessionStatus
    ) -> None:
        """仅更新会话状态（轻量，用于状态机迁移）。"""

    @abc.abstractmethod
    async def delete(self, session_id: str, user_id: str) -> None:
        """删除会话（按 user_id 隔离）。"""

    @abc.abstractmethod
    async def list_sessions(self, user_id: str) -> list[str]:
        """列出某用户的会话 id（多租户隔离）。"""


class InMemoryCheckpointStore(CheckpointStore):
    """内存实现（单测/本地用）。按 user_id 隔离。"""

    def __init__(self) -> None:
        self._store: dict[str, AgentState] = {}

    async def save(self, state: AgentState) -> None:
        self._store[state.session_id] = state

    async def load(self, session_id: str, user_id: str) -> AgentState | None:
        state = self._store.get(session_id)
        if state is None or state.user_id != user_id:
            return None  # 隔离：非本人会话不可见
        return state

    async def update_status(
        self, session_id: str, user_id: str, status: SessionStatus
    ) -> None:
        state = self._store.get(session_id)
        if state is None or state.user_id != user_id:
            raise CheckpointError("会话不存在或无权访问")
        state.status = status

    async def delete(self, session_id: str, user_id: str) -> None:
        state = self._store.get(session_id)
        if state is not None and state.user_id == user_id:
            del self._store[session_id]

    async def list_sessions(self, user_id: str) -> list[str]:
        return [sid for sid, s in self._store.items() if s.user_id == user_id]


class PostgresCheckpointStore(CheckpointStore):
    """PostgreSQL 实现（生产）。

    表 ai_sessions（init.sh 建好）：id/user_id/site_id/page_id/status/created_at/updated_at
    AgentState 完整 JSON 存在 ai_session_states（本类自管，幂等建表）。
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pool: Any = None
        self._initialized = False

    async def _pool_obj(self) -> Any:
        if self._pool is None:
            import asyncpg

            self._pool = await asyncpg.create_pool(self._settings.postgres_dsn)
        return self._pool

    async def _ensure_schema(self, conn: Any) -> None:
        if self._initialized:
            return
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_sessions (
              id VARCHAR(36) PRIMARY KEY,
              user_id VARCHAR(36) NOT NULL,
              site_id VARCHAR(36),
              page_id VARCHAR(36),
              status VARCHAR(32) NOT NULL DEFAULT 'idle',
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id)"
        )
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_session_states (
              session_id VARCHAR(36) PRIMARY KEY,
              user_id VARCHAR(36) NOT NULL,
              state_json JSONB NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ai_session_states_user "
            "ON ai_session_states(user_id)"
        )
        self._initialized = True

    async def save(self, state: AgentState) -> None:
        pool = await self._pool_obj()
        async with pool.acquire() as conn:
            await self._ensure_schema(conn)
            await conn.execute(
                """
                INSERT INTO ai_sessions (id, user_id, site_id, page_id, status)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE SET
                  site_id = EXCLUDED.site_id,
                  page_id = EXCLUDED.page_id,
                  status = EXCLUDED.status,
                  updated_at = now()
                """,
                state.session_id,
                state.user_id,
                state.site_id,
                state.page_id,
                state.status.value,
            )
            await conn.execute(
                """
                INSERT INTO ai_session_states (session_id, user_id, state_json)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (session_id) DO UPDATE SET
                  state_json = EXCLUDED.state_json,
                  updated_at = now()
                """,
                state.session_id,
                state.user_id,
                json.dumps(state.model_dump(mode="json")),
            )

    async def load(self, session_id: str, user_id: str) -> AgentState | None:
        pool = await self._pool_obj()
        async with pool.acquire() as conn:
            await self._ensure_schema(conn)
            row = await conn.fetchrow(
                "SELECT state_json FROM ai_session_states "
                "WHERE session_id = $1 AND user_id = $2",
                session_id,
                user_id,
            )
            if row is None:
                return None
            return AgentState.model_validate(json.loads(row["state_json"]))

    async def update_status(
        self, session_id: str, user_id: str, status: SessionStatus
    ) -> None:
        pool = await self._pool_obj()
        async with pool.acquire() as conn:
            res = await conn.execute(
                "UPDATE ai_sessions SET status = $3, updated_at = now() "
                "WHERE id = $1 AND user_id = $2",
                session_id,
                user_id,
                status.value,
            )
            if res == "UPDATE 0":
                raise CheckpointError("会话不存在或无权访问")

    async def delete(self, session_id: str, user_id: str) -> None:
        pool = await self._pool_obj()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM ai_session_states WHERE session_id = $1 AND user_id = $2",
                session_id,
                user_id,
            )
            await conn.execute(
                "DELETE FROM ai_sessions WHERE id = $1 AND user_id = $2",
                session_id,
                user_id,
            )

    async def list_sessions(self, user_id: str) -> list[str]:
        pool = await self._pool_obj()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id FROM ai_sessions WHERE user_id = $1 ORDER BY updated_at DESC",
                user_id,
            )
            return [r["id"] for r in rows]


def new_session_id() -> str:
    return str(uuid.uuid4())
