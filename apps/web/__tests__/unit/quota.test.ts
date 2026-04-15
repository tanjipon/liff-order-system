import { describe, it, expect } from 'vitest'
import { calcQuotaUsed, assertQuota } from '@/lib/quota'

describe('calcQuotaUsed', () => {
    it('returns 0 for emptuy array', () => {
        expect(calcQuotaUsed([])).toBe(0)
    })

    it('excludes cancelled orders', () => {
        const orders = [
            { status: 'completed', quantity: 1 },
            { status: 'cancelled', quantity: 2 },
            { status: 'in_production', quantity: 1 },
        ]
        expect(calcQuotaUsed(orders)).toBe(2)
    })

    it('includes all non-cancelled statuses', () => {
        const orders = [
            { status: 'pending', quantity: 1 },
            { status: 'in_production', quantity: 1 },
            { status: 'pending_payment', quantity: 1 },
            { status: 'payment_submitted', quantity: 1 },
            { status: 'completed', quantity: 1 },
        ]
        expect(calcQuotaUsed(orders)).toBe(5)
    })
})

describe('assertQuota', () => {
    it('passes when under limit', () => {
        expect(() => assertQuota(1, 0, 2)).not.toThrow()
    })

    it('passes when exactly at limit', () => {
        expect(() => assertQuota(1, 1, 2)).not.toThrow()
    })

    it('throws when over limit', () => {
        expect(() => assertQuota(1, 2, 2)).toThrow('QUOTA_EXCEEDED')
    })

    it('always passes when limit is null', () => {
        expect(() => assertQuota(999, 999, null)).not.toThrow()
    })
})