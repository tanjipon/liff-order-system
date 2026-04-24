import { vi } from 'vitest'

vi.mock('@/lib/auth/verifyAdmin', () => ({
    verifyAdmin: vi.fn().mockResolvedValue({
        userId: 'admin-test-user',
        displayName: '測試管理員',
        roleId: '00000000-0000-0000-0000-000000000001',
        roleName: 'owner',
        permissions: [
            'orders:accept', 'orders:reject', 'orders:mark_ready',
            'orders:cancel', 'orders:confirm_payment',
            'sessions:create', 'sessions:edit', 'stats:view',
            'staff:manage', 'roles:manage',
        ],
    }),
    assertPermission: vi.fn(),
}))

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { GET as getOrders } from '@/app/api/admin/orders/route'
import { GET as getStats } from '@/app/api/admin/sessions/[id]/stats/route'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function adminReq(url: string) {
    return new NextRequest(url, {
        headers: { Authorization: 'Bearer mock' },
    })
}

let sessionId: string
let productId: string

beforeAll(async () => {
    // create session
    const { data: session } = await supabase
        .from('sessions')
        .insert({ title: '統計測試開單', is_active: true })
        .select('id')
        .single()
    sessionId = session!.id

    // create products
    const { data: product } = await supabase
        .from('products')
        .insert({ session_id: sessionId, name: '草莓塔', price: 100, stock_qty: 50 })
        .select('id')
        .single()
    productId = product!.id

    // create orders: 2 completed, 1 cancelled
    for (const status of ['completed', 'completed', 'cancelled']) {
        const { data: order } = await supabase
            .from('orders')
            .insert({
                session_id: sessionId,
                line_user_id: 'U_stats_test',
                line_display_name: '測試用戶',
                status,
                payment_method: 'cash',
                total_amount: 100,
            })
            .select('id')
            .single()

        if (status !== 'cancelled') {
            const { error } = await supabase.from('order_items').insert({
                order_id: order!.id,
                product_id: productId,
                quantity: 2,
                unit_price: 100,
            })
        }
    }
})

describe('GET /admin/orders (history)', () => {
    it('history=true return all orders (include completed)', async () => {
        const req = adminReq(
            `http://localhost/api/admin/orders?history=true&sessionId=${sessionId}`
        )
        const res = await getOrders(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        // 3 筆（含 cancelled）
        expect(body.data.length).toBe(3)
    })

    it('filter status=completed return completed orders only', async () => {
        const req = adminReq(
            `http://localhost/api/admin/orders?history=true&sessionId=${sessionId}&status=completed`
        )
        const res = await getOrders(req)
        const body = await res.json()

        expect(body.data.length).toBe(2)
        expect(body.data.every((o: any) => o.status === 'completed')).toBe(true)
    })

    it('no history only return ongong orders (not include completed)', async () => {
        const req = adminReq(
            `http://localhost/api/admin/orders?sessionId=${sessionId}`
        )
        const res = await getOrders(req)
        const body = await res.json()

        expect(body.data.every((o: any) => o.status !== 'completed')).toBe(true)
    })
})

describe('GET /admin/sessions/:id/stats', () => {
    it('exclude cancelled. only valid orders', async () => {
        const req = adminReq(`http://localhost/api/admin/sessions/${sessionId}/stats`)
        const res = await getStats(req, { params: Promise.resolve({ id: sessionId }) })
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.totalOrders).toBe(2)       // cancelled not included
        expect(body.data.totalAmount).toBe(200)     // 100 * 2
    })

    it('amount sole is correct', async () => {
        const req = adminReq(`http://localhost/api/admin/sessions/${sessionId}/stats`)
        const res = await getStats(req, { params: Promise.resolve({ id: sessionId }) })
        const body = await res.json()

        console.log('full data:', JSON.stringify(body.data, null, 2))  // ← 改成這行// ← 加這行

        const product = body.data.productStats.find((p: any) => p.productId === productId)
        expect(product.totalQty).toBe(4)        // 2 orders.  2 each order
        expect(product.totalRevenue).toBe(400)  // 4 * 100
    })

    it('statusCounts correct', async () => {
        const req = adminReq(`http://localhost/api/admin/sessions/${sessionId}/stats`)
        const res = await getStats(req, { params: Promise.resolve({ id: sessionId }) })
        const body = await res.json()

        expect(body.data.statusCounts.completed).toBe(2)
        expect(body.data.statusCounts.cancelled).toBeUndefined() // excluded
    })
})
