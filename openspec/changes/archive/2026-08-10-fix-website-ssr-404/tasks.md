# Tasks — website SSR 404

## T1: DynamicPage error → createError 404
- `views/DynamicPage.vue` watch [page,error]：error 时 `throw createError({statusCode:404, fatal:true})`
- 验证：website rebuild（测试机）+ e2e ssr-deep SSR3/4 转绿
