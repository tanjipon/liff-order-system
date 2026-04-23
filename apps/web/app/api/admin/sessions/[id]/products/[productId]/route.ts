import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; productId: string }> }
) {
    try {
        const { productId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')
        const supabase = getSupabaseAdmin()

        const { name, price, stockQty } = await req.json()

        const { error } = await supabase
            .from('products')
            .update({ name, price, stock_qty: stockQty })
            .eq('id', productId)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; productId: string }> }
) {
    try {
        const { productId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')
        const supabase = getSupabaseAdmin()

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
