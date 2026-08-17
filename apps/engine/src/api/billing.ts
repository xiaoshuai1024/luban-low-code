/**
 * billing API — 套餐/订阅/用量/订单客户端（signup-billing-onboarding §9.2/§9.5）。
 *
 * 契约要点：
 *  - planCode 命名（v02 契约，非 code）；
 *  - priceMonthly/amount 单位为分（服务端 BIGINT），展示层换算元；
 *  - getPlans 返回裸数组；getOrders 返回 {items,total}（AGENT_RULES §4 分页规范）；
 *  - subscribe 返回 {subscription}（v02 契约别名）；向导/切换主路径走 createOrder
 *    （返回 {order,subscription}，0 元订单同事务自动支付成功）。
 */
import { request } from './request'

/** 套餐（GET /billing/plans 元素；仅 visible 档位由服务端过滤） */
export interface Plan {
  planCode: string
  name: string
  /** 月价（分），本期三档全 0 */
  priceMonthly: number
  /** 月留资配额；0 = 不限 */
  quotaLeads: number
  /** 站点内页面数配额；0 = 不限 */
  quotaPages: number
  /** 月访问量配额；0 = 不限（本期恒 0，analytics 域延后） */
  quotaVisits: number
  /** 试用天数（Starter=14，其余 0） */
  trialDays?: number
}

/** 订阅状态：active 生效中 / trialing 试用中 / expired 已过期 */
export type SubscriptionStatus = 'active' | 'trialing' | 'expired'

/** 用量/配额三元组 */
export interface UsageMetrics {
  leads: number
  pages: number
  visits: number
}

/** 订阅（GET /billing/me；无订阅时服务端回退 free+0） */
export interface Subscription {
  planCode: string
  planName?: string
  status: SubscriptionStatus
  startedAt?: string
  trialEndsAt?: string
  /** /billing/me 响应附带（§9.2）：当前周期用量 */
  usage?: UsageMetrics
  /** /billing/me 响应附带（§9.2）：当前档位配额（0 = 不限） */
  quota?: UsageMetrics
}

/** 用量（GET /billing/usage；period 形如 2026-08） */
export interface Usage extends UsageMetrics {
  period: string
}

/** 订单状态：pending 待支付 / paid 已支付 / cancelled 已取消 */
export type OrderStatus = 'pending' | 'paid' | 'cancelled'

/** 订单（0 元订单创建即 paid） */
export interface Order {
  orderNo: string
  planCode: string
  /** 金额（分） */
  amount: number
  status: OrderStatus
  createdAt: string
  paidAt?: string
}

/** 订单分页结果（AGENT_RULES §4） */
export interface OrderPage {
  items: Order[]
  total: number
}

/** POST /billing/subscribe 响应 */
export interface SubscribeResult {
  subscription: Subscription
}

/** POST /billing/orders 响应（0 元自动支付成功 + 订阅生效） */
export interface CreateOrderResult {
  order: Order
  subscription: Subscription
}

/** 三档套餐列表（裸数组，billing.spec B1） */
export function getPlans() {
  return request.get<Plan[]>('/billing/plans')
}

/** 当前订阅（含 usage/quota，§9.2） */
export function getMyPlan() {
  return request.get<Subscription>('/billing/me')
}

/** 当前周期用量（默认当月；period 形如 2026-08 查指定月） */
export function getUsage(period?: string) {
  return request.get<Usage>('/billing/usage', { params: period ? { period } : undefined })
}

/** 订阅套餐（v02 契约别名保留；主路径走 createOrder） */
export function subscribe(planCode: string) {
  return request.post<SubscribeResult>('/billing/subscribe', { planCode })
}

/** 创建订单（0 元直通 paid；向导 Step1 / billing 页切换主路径） */
export function createOrder(planCode: string) {
  return request.post<CreateOrderResult>('/billing/orders', { planCode })
}

/** 订单分页列表 */
export function getOrders(params?: { page?: number; size?: number }) {
  return request.get<OrderPage>('/billing/orders', { params })
}
