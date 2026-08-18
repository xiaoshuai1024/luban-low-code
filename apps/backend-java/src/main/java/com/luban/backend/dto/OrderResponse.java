package com.luban.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.luban.backend.entity.Order;

import java.time.Instant;

/** 订单载荷（amount 单位分；status: pending/paid/cancelled）。 */
public record OrderResponse(
    String orderNo,
    String planCode,
    long amount,
    String status,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant paidAt,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt
) {
    public static OrderResponse fromEntity(Order o) {
        if (o == null) return null;
        return new OrderResponse(o.getOrderNo(), o.getPlanCode(), o.getAmount(), o.getStatus(), o.getPaidAt(), o.getCreatedAt());
    }
}
