import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  recordFailure,
  clientIpFromRequest,
  resetRateLimiterForTests,
} from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;

describe("rateLimit（内存滑动窗口）", () => {
  beforeEach(() => {
    resetRateLimiterForTests();
  });

  it("窗口内失败 < 10 次不限制，第 10 次失败后触发限流", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 9; i++) {
      recordFailure("1.2.3.4", t0 + i);
      expect(isRateLimited("1.2.3.4", t0 + i + 1)).toBe(false);
    }
    recordFailure("1.2.3.4", t0 + 9);
    expect(isRateLimited("1.2.3.4", t0 + 10)).toBe(true);
  });

  it("滑动窗口：最早一次失败滑出窗口后解除限制", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) {
      recordFailure("1.2.3.4", t0 + i);
    }
    expect(isRateLimited("1.2.3.4", t0 + 10)).toBe(true);
    // 首次失败（t0）滑出 15 分钟窗口
    expect(isRateLimited("1.2.3.4", t0 + WINDOW_MS + 1)).toBe(false);
  });

  it("不同 IP 相互独立", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) recordFailure("1.2.3.4", t0 + i);
    expect(isRateLimited("5.6.7.8", t0 + 11)).toBe(false);
  });

  it("clientIpFromRequest：优先 x-forwarded-for 首段，其次 x-real-ip，兜底 unknown", () => {
    const mk = (headers: Record<string, string>) =>
      new Request("http://localhost/x", { headers });
    expect(clientIpFromRequest(mk({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIpFromRequest(mk({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIpFromRequest(mk({}))).toBe("unknown");
  });
});
