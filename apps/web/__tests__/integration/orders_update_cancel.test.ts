import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

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

import { PUT, DELETE } from '@/app/api/orders/[id]/route'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SESSION_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const PICKUP_OPTION_ID = 'cccccccc-0000-0000-0000-000000000001'

async function resetData() {
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

async function createTestOrder(quantity = 2) {
    const { data: orderId, error } = await supabase.rpc('create_order', {
        p_session_id: SESSION_ID,
        p_line_user_id: 'U_integration_test',
        p_display_name: 'test_user',
        p_items: [{ product_id: PRODUCT_ID, quantity }],
        p_pickup_option_id: PICKUP_OPTION_ID,
        p_payment_method: 'bank_transfer',
    })
    if (error) throw new Error(error.message)
    return orderId as string
}

function makeRequest(method: string, orderId: string, body?: object) {
    return new NextRequest(`http://localhost/api/orders/${orderId}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-liff-token': 'valid-token',
        },
        body: body ? JSON.stringify(body) : undefined,
    })
}


beforeEach(async () => {
    await resetData()
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
})

describe('PUT /api/orders/:id (update order)', () => {
    it('update stock and correctly modified', async () => {
        const orderId = await createTestOrder(2) // 扣 2，剩 18

        const req = makeRequest('PUT', orderId, {
            items: [{ product_id: PRODUCT_ID, quantity: 3 }], // change to 3
        })
        const res = await PUT(req, { params: Promise.resolve({ id: orderId }) })
        const body = await res.json()
        console.log('PUT response:', body)  // 加這行
        expect(res.status).toBe(200)

        const { data: product } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(product?.stock_qty).toBe(17) // 20 - 3
    })

    it('after modified, total_amount correctly recalculated', async () => {
        const orderId = await createTestOrder(2) // 150 × 2 = 300

        const req = makeRequest('PUT', orderId, {
            items: [{ product_id: PRODUCT_ID, quantity: 1 }], // change to 1
        })
        await PUT(req, { params: Promise.resolve({ id: orderId }) })

        const { data: order } = await supabase
            .from('orders').select('total_amount').eq('id', orderId).single()
        expect(order?.total_amount).toBe(150) // 150 × 1
    })

    it('status not pending cannot be modified', async () => {
        const orderId = await createTestOrder(1)
        await supabase.from('orders').update({ status: 'in_production' }).eq('id', orderId)

        const req = makeRequest('PUT', orderId, {
            items: [{ product_id: PRODUCT_ID, quantity: 1 }],
        })
        const res = await PUT(req, { params: Promise.resolve({ id: orderId }) })
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toContain('INVALID_TRANSITION')
    })
})

describe('DELETE /api/orders/:id (client cancel order)', () => {
    it('after cancelled, stock correctly recalculated', async () => {
        const orderId = await createTestOrder(2) // 扣 2，剩 18

        const req = makeRequest('DELETE', orderId)
        const res = await DELETE(req, { params: Promise.resolve({ id: orderId }) })
        expect(res.status).toBe(200)

        const { data: product } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(product?.stock_qty).toBe(20) // 庫存回到 20
    })

    it('after cancelled can reorder (quota released)', async () => {
        const orderId = await createTestOrder(2)

        const req = makeRequest('DELETE', orderId)
        await DELETE(req, { params: Promise.resolve({ id: orderId }) })

        const { error } = await supabase.rpc('create_order', {
            p_session_id: SESSION_ID,
            p_line_user_id: 'U_integration_test',
            p_display_name: 'test_user',
            p_items: [{ product_id: PRODUCT_ID, quantity: 2 }],
            p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method: 'bank_transfer',
        })
        expect(error).toBeNull()
    })

    it('status not pending cannot be cancelled', async () => {
        const orderId = await createTestOrder(1)
        await supabase.from('orders').update({ status: 'in_production' }).eq('id', orderId)

        const req = makeRequest('DELETE', orderId)
        const res = await DELETE(req, { params: Promise.resolve({ id: orderId }) })
        expect(res.status).toBe(400)
    })
})