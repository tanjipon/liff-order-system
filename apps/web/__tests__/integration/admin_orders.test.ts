import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/verifyAdmin', () => ({
    verifyAdmin: vi.fn().mockResolvedValue({
        userId:      'admin-test-user',
        displayName: '測試管理員',
        roleId:      '00000000-0000-0000-0000-000000000001',
        roleName:    'owner',
        permissions: [
            'orders:accept', 'orders:reject', 'orders:mark_ready',
            'orders:cancel', 'orders:confirm_payment',
            'sessions:create', 'sessions:edit', 'stats:view',
            'staff:manage', 'roles:manage',
        ],
    }),
    assertPermission: vi.fn().mockImplementation((ctx: any, permission: string) => {
        if (!ctx.permissions.includes(permission)) {
            throw new Error('FORBIDDEN')
        }
    }),
}))

import { PATCH as accept }         from '@/app/api/admin/orders/[id]/accept/route'
import { PATCH as reject }         from '@/app/api/admin/orders/[id]/reject/route'
import { PATCH as ready }          from '@/app/api/admin/orders/[id]/ready/route'
import { PATCH as cancel }         from '@/app/api/admin/orders/[id]/cancel/route'
import { PATCH as confirmPayment } from '@/app/api/admin/orders/[id]/confirm-payment/route'

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

async function createTestOrder() {
    const { data: orderId, error } = await supabase.rpc('create_order', {
        p_session_id:       SESSION_ID,
        p_line_user_id:     'U_test',
        p_display_name:     'test_user',
        p_items:            [{ product_id: PRODUCT_ID, quantity: 2 }],
        p_pickup_option_id: PICKUP_OPTION_ID,
            p_payment_method:   'bank_transfer',
            p_customer_name: 'test_customer',
            p_customer_phone: '0912345678',
            p_recipient_name: 'test_recipient',
            p_recipient_phone: '0912345678',
            p_recipient_address: null,
    })
    if (error) throw new Error(error.message)
    return orderId as string
}

function makeRequest(orderId: string, body?: object) {
    return new NextRequest(`http://localhost/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer mock-token',
        },
        body: body ? JSON.stringify(body) : undefined,
    })
}

beforeEach(async () => {
    await resetData()
    await supabase.from('products').update({ stock_qty: 20, max_per_person: null }).eq('id', PRODUCT_ID)
})

describe('PATCH /admin/orders/:id/accept', () => {
    it('pending → in_production, return queue number 1', async () => {
        const orderId = await createTestOrder()
        const res = await accept(makeRequest(orderId), { params: Promise.resolve({ id: orderId }) })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data.queueNumber).toBe(1)
    })

    it('the queue number of the 2nd order icreases to 2', async () => {
        const orderId1 = await createTestOrder()
        const orderId2 = await createTestOrder()

        await accept(makeRequest(orderId1), { params: Promise.resolve({ id: orderId1 }) })
        const res = await accept(makeRequest(orderId2), { params: Promise.resolve({ id: orderId2 }) })

        const body = await res.json()
        expect(body.data.queueNumber).toBe(2)
    })
})

describe('PATCH /admin/orders/:id/reject', () => {
    it('pending → cancelled, stock correctly released', async () => {
        const orderId = await createTestOrder() // minus 2，last 18

        const res = await reject(
            makeRequest(orderId, { reason: 'test reject' }),
            { params: Promise.resolve({ id: orderId }) }
        )
        expect(res.status).toBe(200)

        const { data: product } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(product?.stock_qty).toBe(20) // stock back to 20
    })
})

describe('PATCH /admin/orders/:id/ready', () => {
    it('in_production → pending_payment', async () => {
        const orderId = await createTestOrder()
        await accept(makeRequest(orderId), { params: Promise.resolve({ id: orderId }) })

        const res = await ready(makeRequest(orderId), { params: Promise.resolve({ id: orderId }) })
        expect(res.status).toBe(200)

        const { data: order } = await supabase
            .from('orders').select('status').eq('id', orderId).single()
        expect(order?.status).toBe('pending_payment')
    })
})

describe('PATCH /admin/orders/:id/cancel', () => {
    it('in_production → cancelled, stock correctly released', async () => {
        const orderId = await createTestOrder()
        await accept(makeRequest(orderId), { params: Promise.resolve({ id: orderId }) })

        const res = await cancel(
            makeRequest(orderId, { reason: 'test cancel' }),
            { params: Promise.resolve({ id: orderId }) }
        )
        expect(res.status).toBe(200)

        const { data: product } = await supabase
            .from('products').select('stock_qty').eq('id', PRODUCT_ID).single()
        expect(product?.stock_qty).toBe(20)
    })

    it('payment_submitted not cancellable', async () => {
        const orderId = await createTestOrder()
        await supabase.from('orders').update({ status: 'payment_submitted' }).eq('id', orderId)

        const res = await cancel(
            makeRequest(orderId, { reason: 'test' }),
            { params: Promise.resolve({ id: orderId }) }
        )
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toContain('CANNOT_CANCEL_PAYMENT_SUBMITTED')
    })
})

describe('PATCH /admin/orders/:id/confirm-payment', () => {
    it('payment_submitted → completed', async () => {
        const orderId = await createTestOrder()
        await supabase.from('orders').update({ status: 'payment_submitted' }).eq('id', orderId)

        const res = await confirmPayment(makeRequest(orderId), { params: Promise.resolve({ id: orderId }) })
        expect(res.status).toBe(200)

        const { data: order } = await supabase
            .from('orders').select('status').eq('id', orderId).single()
        expect(order?.status).toBe('completed')
    })
})

describe('RBAC 權限驗證', () => {
    it('no orders:cancel permission return FORBIDDEN', async () => {
        const { verifyAdmin } = await import('@/lib/auth/verifyAdmin')
        vi.mocked(verifyAdmin).mockResolvedValueOnce({
            userId:      'assistant-user',
            displayName: '助理',
            roleId:      '00000000-0000-0000-0000-000000000002',
            roleName:    'assistant',
            permissions: ['orders:accept'], // no orders:cancel
        })

        const orderId = await createTestOrder()
        const res = await cancel(
            makeRequest(orderId, { reason: '測試' }),
            { params: Promise.resolve({ id: orderId }) }
        )

        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toBe('FORBIDDEN')
    })
})
