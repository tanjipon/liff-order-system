import { NextRequest } from 'next/server'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()

        const {
            sessionId, items, pickupOptionId, paymentMethod,
            customerName, customerPhone,
            recipientName, recipientPhone, recipientAddress,
        } = await req.json()

        const { data: orderId, error } = await supabase.rpc('create_order', {
            p_session_id:           sessionId,
            p_line_user_id:         profile.userId,
            p_display_name:         profile.displayName,
            p_items:                items,
            p_pickup_option_id:     pickupOptionId,
            p_payment_method:       paymentMethod,
            p_customer_name:        customerName ?? '',
            p_customer_phone:       customerPhone ?? '',
            p_recipient_name:       recipientName ?? '',
            p_recipient_phone:      recipientPhone ?? '',
            p_recipient_address:    recipientAddress ?? null,
        })

        if (error) {
            const [code, productName] = error.message.split(':')
            const msgMap: Record<string, string> = {
                PRODUCT_QUOTA_EXCEEDED: productName ? `「${productName}」已超過每人購買上限` : '已超過此商品每人購買上限',
                INSUFFICIENT_STOCK:     productName ? `「${productName}」庫存不足` : '商品庫存不足',
                QUOTA_EXCEEDED:         '已超過本次開單每人購買上限',
                SESSION_NOT_ACTIVE:     '目前沒有開放中的開單',
                PRODUCT_NOT_FOUND:      '商品不存在',
                PICKUP_OPTION_NOT_FOUND: '取貨方式不存在或已停用',
            }
            return Response.json(
                { error: code, message: msgMap[code] ?? '訂單送出失敗，請再試一次' },
                { status: 400 }
            )
        }

        const { data: order } = await supabase
            .from('orders')
            .select('order_number')
            .eq('id', orderId)
            .single()

        return Response.json({ data: { orderId, orderNumber: order?.order_number ?? null } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function GET(req: NextRequest) {
    try {
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                session_id,
                order_number,
                status,
                payment_method,
                total_amount,
                pickup_fee,
                remit_last5,
                queue_number,
                created_at,
                customer_note,
                sessions ( title ),
                order_items (
                    quantity,
                    unit_price,
                    product_id,
                    products ( name )
                )
            `)
            .eq('line_user_id', profile.userId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        return Response.json({ data: orders })
    } catch (e: any) {
        return errorResponse(e.message)
    }
} 