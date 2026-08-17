package com.luban.backend.controller;

import com.luban.backend.auth.UserContext;
import com.luban.backend.dto.BillingMeResponse;
import com.luban.backend.entity.Subscription;
import com.luban.backend.dto.OrderCreateRequest;
import com.luban.backend.dto.OrderCreateResponse;
import com.luban.backend.dto.PlanResponse;
import com.luban.backend.dto.SubscribeRequest;
import com.luban.backend.dto.SubscriptionResponse;
import com.luban.backend.dto.UsageResponse;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.service.OrderService;
import com.luban.backend.service.PlanService;
import com.luban.backend.service.QuotaService;
import com.luban.backend.service.SubscriptionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * billing 域端点（T-be-3/T-be-4；鉴权=登录用户，AuthFilter 默认 RequireUser）。
 * 契约见 plan §9.2：plans 裸数组 / me 含 usage+quota / subscribe 别名 / orders 0 元直通。
 */
@RestController
@RequestMapping("/billing")
public class BillingController {

    private static final Pattern PERIOD_PATTERN = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");

    private final PlanService planService;
    private final SubscriptionService subscriptionService;
    private final QuotaService quotaService;
    private final OrderService orderService;

    public BillingController(PlanService planService,
                             SubscriptionService subscriptionService,
                             QuotaService quotaService,
                             OrderService orderService) {
        this.planService = planService;
        this.subscriptionService = subscriptionService;
        this.quotaService = quotaService;
        this.orderService = orderService;
    }

    @GetMapping("/plans")
    public List<PlanResponse> plans() {
        return planService.listVisible().stream().map(PlanResponse::fromEntity).collect(Collectors.toList());
    }

    @GetMapping("/me")
    public BillingMeResponse me() {
        String userId = UserContext.getUserId();
        Subscription subscription = subscriptionService.getOrFallback(userId);
        String period = QuotaService.currentPeriod();
        BillingMeResponse.Snapshot usage = new BillingMeResponse.Snapshot(
                quotaService.getCount(userId, period, QuotaService.METRIC_LEADS),
                quotaService.getCount(userId, period, QuotaService.METRIC_PAGES),
                quotaService.getCount(userId, period, QuotaService.METRIC_VISITS));
        BillingMeResponse.Snapshot quota = new BillingMeResponse.Snapshot(
                quotaService.quotaOf(userId, QuotaService.METRIC_LEADS),
                quotaService.quotaOf(userId, QuotaService.METRIC_PAGES),
                quotaService.quotaOf(userId, QuotaService.METRIC_VISITS));
        SubscriptionResponse sub = subscriptionService.toResponse(subscription);
        return new BillingMeResponse(
                sub.planCode(), sub.planName(), sub.status(), sub.trialEndsAt(), usage, quota);
    }

    @GetMapping("/usage")
    public UsageResponse usage(@RequestParam(value = "period", required = false) String period) {
        String resolved = period != null && !period.isBlank() ? period : QuotaService.currentPeriod();
        if (!PERIOD_PATTERN.matcher(resolved).matches()) {
            throw BusinessException.invalidArgument("period: 格式应为 yyyy-MM");
        }
        String userId = UserContext.getUserId();
        return new UsageResponse(
                resolved,
                quotaService.getCount(userId, resolved, QuotaService.METRIC_LEADS),
                quotaService.getCount(userId, resolved, QuotaService.METRIC_PAGES),
                quotaService.getCount(userId, resolved, QuotaService.METRIC_VISITS));
    }

    /** v02 契约别名：{subscription:{...}}（向导/换档主路径走 POST /billing/orders）。 */
    @PostMapping("/subscribe")
    public Map<String, SubscriptionResponse> subscribe(@Valid @RequestBody SubscribeRequest req) {
        String userId = UserContext.getUserId();
        Subscription subscription = subscriptionService.applyPlan(userId, req.planCode());
        return Map.of("subscription", subscriptionService.toResponse(subscription));
    }

    @PostMapping("/orders")
    public OrderCreateResponse createOrder(@Valid @RequestBody OrderCreateRequest req) {
        return orderService.createOrder(UserContext.getUserId(), req.planCode());
    }

    @GetMapping("/orders")
    public Map<String, Object> orders(@RequestParam(value = "page", defaultValue = "1") int page,
                                      @RequestParam(value = "size", defaultValue = "10") int size) {
        return orderService.listOrders(UserContext.getUserId(), page, size);
    }
}
