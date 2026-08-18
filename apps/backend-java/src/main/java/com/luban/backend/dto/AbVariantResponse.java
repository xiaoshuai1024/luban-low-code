package com.luban.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** AB 变体响应（schema 由存储的 raw JSON 文本解析为嵌套对象，坏数据降级 null）。 */
public record AbVariantResponse(String id, String variantKey, int weight, JsonNode schema) {
}
