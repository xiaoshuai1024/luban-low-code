# Tasks — Backend test H2 profile

## T1: LeadServiceIntegrationTest 走 test profile + mock AntiSpam
- 加 `@ActiveProfiles("test")`（H2）、`@MockBean AntiSpamService`（默认 isRateLimited=false 放行，避开空 Redis）
- 验证：容器 `mvn test -Dtest=LeadServiceIntegrationTest` → 3 passed
