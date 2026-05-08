import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')
        const supabase = getSupabaseAdmin()
        const { id } = await params

        const body = await req.json()
        const updates: Record<string, unknown> = {}
        if (body.imageUrl !== undefined) updates.image_url = body.imageUrl
        if (body.name !== undefined) updates.name = body.name
        if (body.price !== undefined) updates.price = body.price
        if (body.stockQty !== undefined) updates.stock_qty = body.stockQty

        const { error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)

        if (error) throw new Error(error.message)

        return Response.json({ data: { ok: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
