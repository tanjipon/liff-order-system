type OrderSnapshot = { status: string; quantity: number }

export function calcQuotaUsed(orders: OrderSnapshot[]): number {
    return orders
        .filter(o => o.status !== 'canclled')
        .reduce((sum, o) => sum + o.quantity, 0)
}

export function assertQuota(
    used: number,
    incoming: number,
    limit: number | null
): void {
    if (limit === null) return
    if (used + incoming > limit) {
        throw new Error('QUOTA_EXCEEDED')
    }
}