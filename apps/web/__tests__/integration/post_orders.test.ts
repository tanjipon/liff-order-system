import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// mock verifyLiffToken — 必須在 import route 之前宣告
vi.mock('@/lib/auth/verifyLiff', () => ({
    verifyLiffToken: vi.fn().mockImplementation((req: NextRequest) => {
        const token = req.headers.get('x-liff-token')
        if (!token) throw new Error('UNAUTHORIZED')
        return Promise.resolve({
            userId: 'U_integration_test',
            displayName: 'test_user',
        })
    })
}))

// 在同一個 process 內直接呼叫 route handler，mock 才能生效
import { POST } from '@/app/api/orders/route'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SESSION_ID       = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUCT_ID       = 'bbbbbbbb-0000-0000-0000-000000000001'
const PICKUP_OPTION_ID = 'cccccccc-0000-0000-0000-000000000001'

async function resetData() {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

beforeEach(async () => {
    await resetData()
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
})

// 直接構造 NextRequest 呼叫 route handler，不需要 dev server
function makeRequest(body: object, token = 'valid-token') {
    return new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-liff-token': token,
        },
        body: JSON.stringify(body),
    })
}

describe('POST /api/orders', () => {
    it('Normal order: return 201 and orderId', async () => {
        const req = makeRequest({
            sessionId:      SESSION_ID,
            items:          [{ product_id: PRODUCT_ID, quantity: 2 }],
            pickupOptionId: PICKUP_OPTION_ID,
            paymentMethod:  'bank_transfer',
        })

        const res = await POST(req)
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.data.orderId).toBeTruthy()
    })

    it('No LIFF token: return 400 UNAUTHORIZED', async () => {
        const req = makeRequest({
            sessionId:      SESSION_ID,
            items:          [{ product_id: PRODUCT_ID, quantity: 1 }],
            pickupOptionId: PICKUP_OPTION_ID,
            paymentMethod:  'bank_transfer',
        }, '') // empty token

        const res = await POST(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toBe('UNAUTHORIZED')
    })

    it('Quota exceeded: return 400 QUOTA_EXCEEDED', async () => {
        const req = makeRequest({
            sessionId:      SESSION_ID,
            items:          [{ product_id: PRODUCT_ID, quantity: 6 }], // limit is 5
            pickupOptionId: PICKUP_OPTION_ID,
            paymentMethod:  'bank_transfer',
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toBe('QUOTA_EXCEEDED')
    })

    it('Out of stock: return 400 INSUFFICIENT_STOCK', async () => {
        await supabase.from('products').update({ stock_qty: 0 }).eq('id', PRODUCT_ID)

        const req = makeRequest({
            sessionId:      SESSION_ID,
            items:          [{ product_id: PRODUCT_ID, quantity: 1 }],
            pickupOptionId: PICKUP_OPTION_ID,
            paymentMethod:  'bank_transfer',
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toContain('INSUFFICIENT_STOCK')
    })
})
