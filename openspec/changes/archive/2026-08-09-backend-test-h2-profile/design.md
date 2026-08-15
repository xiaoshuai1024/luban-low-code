# Design — Backend test H2 profile

## 根因
- `LeadServiceIntegrationTest`：`@SpringBootTest` 无 `@ActiveProfiles` → 默认 profile（application.yml）→ 连真实 MySQL → Communications link failure。
- `AntiSpamService.isRateLimited` 用 `StringRedisTemplate`；test profile Redis 指 6399（不存在）。`LeadService.submit` 必触达防刷。

## 修法
- `@ActiveProfiles("test")` → H2 + Flyway h2-migration（test profile 已配）。
- `@MockBean AntiSpamService`（MockBean 默认 boolean 返回 false = 放行）→ 不连 Redis。dedupService 经 DB（H2），无需 Redis。
- `@Transactional` 已有 → 自动回滚。

## 决策
不改生产代码；纯测试 profile/bean 修复。
