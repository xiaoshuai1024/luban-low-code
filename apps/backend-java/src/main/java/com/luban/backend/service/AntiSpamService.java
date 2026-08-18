package com.luban.backend.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 留资防刷：基于 Redis 的固定窗口频控（维度 IP + formId）+ 验证码占位。
 * 计数与 TTL 通过单条 Lua 脚本原子执行（close-tech-debt-1 3.2），进程中断不会留下永不过期的计数键。
 * 纯逻辑通过 mock StringRedisTemplate 单测覆盖，不依赖 Redis 实际运行。
 */
@Service
public class AntiSpamService {

    /**
     * 固定窗口频控原子脚本：
     * - INCR 计数；EXPIRE NX 仅在键无 TTL 时设置窗口（INCR 新建的键必无 TTL → 必设置；
     *   历史遗留的无 TTL 键再次命中时自愈补上 TTL）。
     * - 单脚本由 Redis 单线程原子执行，消除旧「increment + expire 两步」在进程中断后
     *   留下永不过期键 → 该 IP/form 永久限流的问题。
     * - EXPIRE NX 需 Redis 7.0+（部署栈为 redis:7-alpine，见 docker-compose.yml）。
     */
    static final String RATE_LIMIT_LUA =
            "local count = redis.call('INCR', KEYS[1]) "
            + "redis.call('EXPIRE', KEYS[1], ARGV[1], 'NX') "
            + "return count";

    private static final RedisScript<Long> RATE_LIMIT_SCRIPT =
            new DefaultRedisScript<>(RATE_LIMIT_LUA, Long.class);

    private final StringRedisTemplate redis;

    public AntiSpamService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * 固定窗口频控。返回 true 表示已达阈值，应拒绝（LEAD_SPAM_BLOCKED）。
     *
     * @param ip             客户端 IP（X-Forwarded-For）
     * @param formId         表单 ID
     * @param max            窗口内最大允许次数（&lt;=0 跳过频控）
     * @param windowSeconds  窗口秒数（&lt;=0 跳过频控，防御非法配置）
     */
    public boolean isRateLimited(String ip, String formId, int max, int windowSeconds) {
        if (ip == null || ip.isBlank() || formId == null || max <= 0 || windowSeconds <= 0) {
            return false;
        }
        Long count = redis.execute(RATE_LIMIT_SCRIPT, List.of(key(ip, formId)),
                String.valueOf(windowSeconds));
        return count != null && count > max;
    }

    /**
     * 图形验证码 token 校验（P0 占位：P0 默认不强制图形码，由 form 配置决定）。
     * 真实接入时替换为 captcha 服务校验。
     */
    public boolean verifyCaptcha(String token) {
        return true;
    }

    private static String key(String ip, String formId) {
        return "antispam:form:" + formId + ":ip:" + ip;
    }
}
