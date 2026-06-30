import { NextRequest } from 'next/server'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()

        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                status,
                payment_method,
                total_amount,
                pickup_fee,
                remit_last5,
                queue_number,
                created_at,
                customer_note,
                customer_name,
                customer_phone,
                recipient_name,
                recipient_phone,
                recipient_address,
                sessions ( title, per_person_limit ),
                pickup_options ( name, description ),
                order_items (
                    quantity,
                    unit_price,
                    product_id,
                    products ( name, max_per_person, stock_qty )
                )
            `)
            .eq('id', id)
            .eq('line_user_id', profile.userId)
            .single()

        if (error || !order) return errorResponse('ORDER_NOT_FOUND', 404)

        return Response.json({ data: order })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function PUT (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }>  }
) {
    try {
        const { id } = await params
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()
        const { items } = await req.json()

        const { error } = await supabase.rpc('update_order', {
            p_order_id:     id,
            p_line_user_id: profile.userId,
            p_items:        items
        })

        if (error) {
            const [code, productName] = error.message.split(':')
            const msgMap: Record<string, string> = {
                PRODUCT_QUOTA_EXCEEDED: productName ? `「${productName}」已超過每人購買上限` : '已超過此商品每人購買上限',
                INSUFFICIENT_STOCK:     productName ? `「${productName}」庫存不足` : '商品庫存不足',
                QUOTA_EXCEEDED:         '已超過本次開單每人購買上限',
                PRODUCT_NOT_FOUND:      '商品不存在',
            }
            return Response.json(
                { error: code, message: msgMap[code] ?? '修改失敗，請再試一次' },
                { status: 400 }
            )
        }

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function DELETE (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const profile = await verifyLiffToken(req)
        const supabase = getSupabaseAdmin()

        // 1. get order and validate owner
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('status, line_user_id')
            .eq('id', id)
            .single()

        if (fetchError || !order) return errorResponse('ORDER_NOT_FOUND', 404)
        if (order.line_user_id !== profile.userId) throw errorResponse('FORBIDDEN', 403)

        // 2. status check: only in pending status can be deleted
        if (order.status !== 'pending') return errorResponse('INVALID_TRANSITION', 400)

        // 3. call DB function to release stock and update status
        const { error } = await supabase.rpc('admin_cancel_order', {
            p_order_id: id,
            p_reason: '客戶自行取消'
        })

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}