package com.luban.backend.dto;

/** POST /billing/orders 成功响应：0 元同事务支付成功 + 订阅生效（§9.2 契约）。 */
public record OrderCreateResponse(OrderResponse order, SubscriptionResponse subscription) {}
