/**
 * V2-T10 analytics 类型（website 消费侧）。
 * 与 engine SiteAnalytics 同构。
 */
export interface SiteAnalytics {
  ga4?: { measurementId: string }
  baidu?: { id: string }
  facebook?: { pixelId: string }
}
