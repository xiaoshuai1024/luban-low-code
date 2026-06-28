"""Agent 工具调用层:经 httpx 回环 BFF 读取业务数据(M4)。

设计:
- 工具调用走 BFF 的 API(非直连 Java/Go),享受双后端契约抹平。
- 回环时带服务身份头 X-AI-Service(供 BFF 审计)+ 用户身份(X-User-Id/Role)。
- 失败重试(tenacity),超限降级(返回 None,agent 据此调整)。
- visitor 角色禁工具调用(在节点层拦截,工具层不重复判)。

工具清单(M4 范围):
- get_page_schema(site_id, page_id): 读当前页面 schema(供 generate 参考现有结构)
- list_leads(site_id): 查线索列表(供"查线索"意图)
- get_lead(lead_id): 查单个线索详情
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# 工具调用回环重试上限(M4 契约:回环重试≤N)
_TOOL_MAX_RETRIES = 3
_TOOL_TIMEOUT = 10.0


@dataclass
class ToolClient:
    """BFF 回环客户端(可注入 mock 供测试)。

    base_url: BFF 地址(如 http://localhost:3100)
    ai_service_token: AI 服务身份 token(BFF 校验,与 BFF→AI 的 internal_token 同源或独立)
    user_id / user_role: BFF 透传的用户身份(回环时带,供 BFF 鉴权/审计)
    """

    base_url: str
    ai_service_token: str = ""
    user_id: str = ""
    user_role: str = "admin"
    _client: httpx.AsyncClient | None = None

    def _headers(self) -> dict[str, str]:
        h = {"X-AI-Service": "luban-ai"}
        if self.ai_service_token:
            h["X-Internal-Token"] = self.ai_service_token
        if self.user_id:
            h["X-User-Id"] = self.user_id
        if self.user_role:
            h["X-User-Role"] = self.user_role
        return h

    async def _client_(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=_TOOL_TIMEOUT,
                trust_env=False,  # 禁系统代理(同 Qdrant,本机 macOS 代理拦截)
            )
        return self._client

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        stop=stop_after_attempt(_TOOL_MAX_RETRIES),
        wait=wait_exponential(multiplier=0.5, max=3),
        reraise=True,
    )
    async def get_page_schema(self, site_id: str, page_id: str) -> dict[str, Any] | None:
        """读当前页面 schema(供 generate 参考现有结构)。失败返回 None。"""
        try:
            client = await self._client_()
            resp = await client.get(
                f"/api/sites/{site_id}/pages/{page_id}", headers=self._headers()
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return data
        except Exception as e:
            logger.warning("get_page_schema 回环失败(%s/%s): %s", site_id, page_id, e)
            return None

    @retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        stop=stop_after_attempt(_TOOL_MAX_RETRIES),
        wait=wait_exponential(multiplier=0.5, max=3),
        reraise=True,
    )
    async def list_leads(self, site_id: str, limit: int = 20) -> list[dict[str, Any]]:
        """查线索列表。失败返回空列表。"""
        try:
            client = await self._client_()
            resp = await client.get(
                "/api/leads",
                params={"siteId": site_id, "limit": limit},
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            # BFF 可能返回 {items:[]} 或 {data:[]} 或裸 list,统一适配
            if isinstance(data, list):
                return data
            return data.get("items") or data.get("data") or []
        except Exception as e:
            logger.warning("list_leads 回环失败(%s): %s", site_id, e)
            return []

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


__all__ = ["ToolClient"]
