import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')

        const { name, price, stockQty } = await req.json()

        if (!name || price == null || stockQty == null) {
            return errorResponse('MISSING_FIELDS', 400)
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                session_id: sessionId,
                name,
                price,
                stock_qty: stockQty,
            })
            .select('id')
            .single()

        if (error) throw new Error(error.message)

        return Response.json({ data: { productId: data.id } }, { status: 201 })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
