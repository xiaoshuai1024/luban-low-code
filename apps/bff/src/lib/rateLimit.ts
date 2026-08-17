/**
 * 登录/注册接口按 IP 的内存滑动窗口失败限流（防撞库/防刷）。
 *
 * Next route 是无状态的，这里进程内存实现即可满足当前单实例部署；
 * 多实例水平扩容时需替换为 Redis 等共享存储。
 * 窗口内失败次数达到阈值后拒绝该 IP 的后续尝试（429）。
 * scope 隔离不同接口：同一 IP 在 login/register/verify/resend 的失败互不累计。
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

/** 限流维度：login（默认，兼容既有调用）| register | verify | resend */
export type RateLimitScope = "login" | "register" | "verify" | "resend";

/** `${scope}:${ip}` → 窗口内失败时间戳列表 */
const failuresByKey = new Map<string, number[]>();

function recentFailures(key: string, now: number): number[] {
  return (failuresByKey.get(key) || []).filter((t) => now - t < WINDOW_MS);
}

/** 该 IP 在该 scope 窗口内失败次数是否已达阈值（放行前检查）。 */
export function isRateLimited(
  ip: string,
  now: number = Date.now(),
  scope: RateLimitScope = "login"
): boolean {
  return recentFailures(`${scope}:${ip}`, now).length >= MAX_FAILURES;
}

/** 记录一次失败（窗口自动滑动）。 */
export function recordFailure(
  ip: string,
  now: number = Date.now(),
  scope: RateLimitScope = "login"
): void {
  const key = `${scope}:${ip}`;
  const ts = recentFailures(key, now);
  ts.push(now);
  failuresByKey.set(key, ts);
}

/** 从请求提取客户端 IP：优先 x-forwarded-for 首段，其次 x-real-ip，兜底 unknown。 */
export function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  if (first) return first;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 仅测试用：清空限流状态。 */
export function resetRateLimiterForTests(): void {
  failuresByKey.clear();
}
