/**
 * 登录接口按 IP 的内存滑动窗口失败限流（防撞库）。
 *
 * Next route 是无状态的，这里进程内存实现即可满足当前单实例部署；
 * 多实例水平扩容时需替换为 Redis 等共享存储。
 * 窗口内失败次数达到阈值后拒绝该 IP 的后续登录尝试（429）。
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

/** ip → 窗口内失败时间戳列表 */
const failuresByIp = new Map<string, number[]>();

function recentFailures(ip: string, now: number): number[] {
  return (failuresByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS);
}

/** 该 IP 在窗口内失败次数是否已达阈值（放行前检查）。 */
export function isRateLimited(ip: string, now: number = Date.now()): boolean {
  return recentFailures(ip, now).length >= MAX_FAILURES;
}

/** 记录一次登录失败（窗口自动滑动）。 */
export function recordFailure(ip: string, now: number = Date.now()): void {
  const ts = recentFailures(ip, now);
  ts.push(now);
  failuresByIp.set(ip, ts);
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
  failuresByIp.clear();
}
