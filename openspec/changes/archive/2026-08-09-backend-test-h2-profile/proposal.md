# Backend integration tests on H2 test profile

## Why
`LeadServiceIntegrationTest`(3 个 @SpringBootTest 集成测试)未声明 `@ActiveProfiles("test")`，走默认 profile 连真实 MySQL，上一轮容器内 `mvn test` 全部 `Communications link failure`，致 Java 单测 78/81。

## What Changes
- `LeadServiceIntegrationTest` 加 `@ActiveProfiles("test")`：走 `application-test.yml` 的 H2 内存库 + Flyway h2-migration。
- 加 `@MockBean AntiSpamService`（stub `isRateLimited` → false）：避免连 test profile 的空 Redis（6399），因 `LeadService.submit` 经防刷触达 Redis。

## Capabilities
无产品 spec 变更（纯测试修复）。**Opt out of spec delta（skip_specs）。**

## Impact
- 代码：`apps/backend-java/src/test/.../LeadServiceIntegrationTest.java`（1 文件）
- 验证：`mvn test -Dtest=LeadServiceIntegrationTest`（容器 temurin-17）3 passed
- 风险：低，仅测试
