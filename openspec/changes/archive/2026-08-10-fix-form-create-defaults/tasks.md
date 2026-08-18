# Tasks — Fix form create defaults

## T1: FormService.create fieldSchema 默认 "[]"
- line 51：`fieldSchema` null → `"[]"`（与 submitConfig "{}" 对称）
- 验证：`mvn -f apps/backend-java/pom.xml test`（Java17）编译 + FormService 相关单测通过
