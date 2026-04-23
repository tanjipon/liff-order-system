import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST (req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')
        const supabase = getSupabaseAdmin()

        const { sessionId, name, price, stockQty } = await req.json()

        const { data, error } = await supabase
            .from('products')
            .insert({
                session_id: sessionId,
                name,
                price,
                stock_qty: stockQty
            })
            .select('id')
            .single()
    
        if (error) throw new Error(error.message)

        return Response.json({ data: { productId: data.id } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}