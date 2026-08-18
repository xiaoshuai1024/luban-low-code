# Proposal: close-tech-debt-1

## Why

两轮大收口（close-review-gaps、wire-e2e-feature-gaps）落地后，review 与实施过程中记录的存量技术债务仍未清：撤销栈三分区、覆盖率门禁空转、BFF 旧路由错误处理、防刷配置化、marketing 组件零测试等。本 change 一次性清偿，使四栈门禁从「测试通过」升级到「覆盖率可度量 + 债务归零」。

## What Changes

- **engine**：PropertyPanel animation/cmsBinding/datasource 三分区改 emit 模式（撤销时序对齐，复用 props/style/events 已验证方案）；DatasourceManageDialog 非法 JSON 保存拦截；三套 FeatureGate 判定统一（features.ts 语义为 SSOT，删除死文件 featuregates.ts）
- **BFF**：~10 个旧路由统一 toBackendResponse 错误契约；api-keys revoke 与 leads export 裸 fetch 改 callBackend（带超时）；submit 路由 X-Forwarded-For 取末段（nginx 追加语义）+ 非 JSON body 400
- **Java**：LeadService 防刷参数从 form.antiSpamJson 读取（无配置回退默认 5/60s）；GlobalExceptionHandler 500 响应收敛内部细节；AntiSpamService increment+expire 原子化（Lua/事务）
- **覆盖率门禁真实化**：engine/bff 配 vitest coverage json-summary reporter；ui 配 threshold；Java pom 启用 jacoco——coverage-summary.sh 可采集真实行覆盖率（当前全为 `-`）
- **UI 测试债**：marketing 14 组件补单测（默认渲染/props/slot 最小集）；删除 NxWelcome 脚手架残留与 .gitkeep
- **journey 门禁**：J-* P0 旅程补 @J-xxx spec 标签绑定或 journey-registry 状态修正（消除 P0 阻断假红）

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `engine`: 属性面板全分区可撤销；数据源配置保存校验；FeatureGate 判定单一实现
- `bff`: 全路由统一错误契约与超时；防刷头不可伪造
- `backend-java`: 防刷配置化生效；错误响应不泄漏内部信息
- `infra`: coverage-summary 输出真实行覆盖率且未达标阻断；journey 门禁与 spec 实态一致
- `ui`: marketing 物料有单测覆盖；脚手架残留清理

## Impact

- engine/BFF/Java 各若干文件；vitest 配置 ×2、ui vitest 配置、pom.xml（jacoco）
- 不改产品行为语义（防刷参数从硬编码变配置读取除外——这是修复「存了不读」缺陷）
- 预期 `make test-coverage` 从「实际值全 -」变为真实数值并可阻断
