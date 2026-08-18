# Tasks: close-tech-debt-1

## 1. engine 债务

- [x] 1.1 PropertyPanel animation 分区改 emit 模式（撤销时序对齐）
- [x] 1.2 PropertyPanel cmsBinding 分区改 emit 协议（v-model setter 重构，独立 commit）
- [x] 1.3 PropertyPanel datasource 分区改 emit 模式
- [x] 1.4 DatasourceManageDialog 非法 JSON 保存拦截（提示 + 不发请求）
- [x] 1.5 FeatureGate 判定统一：features.ts 为 SSOT，useFeatureGate 复用其语义（'1'→开），删除 featuregates.ts 及其 spec
- [x] 1.6 单测：三分区撤销用例 + 对话框校验用例 + '1' 判定用例

## 2. BFF 债务

- [x] 2.1 ~10 旧路由补 toBackendResponse（users×3/sites/settings/pages/api-keys/auth×3）
- [x] 2.2 api-keys revoke + leads export 改 callBackend（超时），删过时注释
- [x] 2.3 submit 路由：XFF 取末段 + 非对象 body 400
- [x] 2.4 单测更新（错误透传/XFF/body 校验）

## 3. Java 债务

- [x] 3.1 LeadService 从 form.antiSpamJson 解析防刷参数（回退 5/60s）传入 AntiSpamService
- [x] 3.2 AntiSpamService 原子计数（Lua INCR+EXPIRE）+ 带参窗口
- [x] 3.3 GlobalExceptionHandler 500 收敛（细节仅日志）
- [x] 3.4 单测：配置化防刷生效 / 500 无内部细节 / 原子计数

## 4. 覆盖率与门禁

- [x] 4.1 engine/bff vitest coverage json-summary reporter；ui vitest 同步配置
- [x] 4.2 pom 启用 jacoco（verify 绑定 report）
- [x] 4.3 本地跑 make test-coverage 验证实际值可采集（记录各包数值）
- [x] 4.4 journey-registry 与 @J 标签对账（P0 全部绑定或显式 planned:false），journey-coverage 不再假红
- [x] 4.5 marketing 14 组件单测补齐 + NxWelcome/.gitkeep 清理

## 5. 收口

- [x] 5.1 各栈验证（engine/bff pnpm test+build、mvn verify、packages/ui test）
- [x] 5.2 push → CI 双绿 → PR → 归档
