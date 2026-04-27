import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'stats:view')

        const supabase = getSupabaseAdmin()

        // 1. All non-cancelled orders
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                id, status, total_amount,
                order_items (
                    quantity, unit_price,
                    products ( id, name )
                )
            `)
            .eq('session_id', sessionId)
            .neq('status', 'cancelled')

        if (ordersError) throw new Error(ordersError.message)

        const orderList = orders ?? []
        console.log('orderList order_items:', JSON.stringify(orderList.map(o => o.order_items)))


        // 2. Calculate stats
        const totalOrders = orderList.length
        const totalAmount = orderList.reduce((sum, o) => sum + o.total_amount, 0)

        // 3. Amounts every product selled
        const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}

        for (const order of orderList) {
            for (const item of order.order_items) {
                const product = (item.products as unknown as { id: string; name: string } | null)
                if (!product) continue
                if (!productMap[product.id]) {
                    productMap[product.id] = { name: product.name, qty: 0, revenue: 0 }
                }
                productMap[product.id].qty += item.quantity
                productMap[product.id].revenue += item.quantity * item.unit_price
            }
        }

        const productStats = Object.entries(productMap).map(([id, p]) => ({
            productId: id,
            name: p.name,
            totalQty: p.qty,
            totalRevenue: p.revenue,
        }))

        // 4. Amount of every order status
        const statusCounts = orderList.reduce<Record<string, number>>((acc, o) => {
            acc[o.status] = (acc[o.status] ?? 0) + 1
            return acc
        }, {})

        return Response.json({
            data: {
                totalOrders,
                totalAmount,
                statusCounts,
                productStats,
            }
        })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
