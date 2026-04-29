import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ restockId: string }> }
) {
    try {
        const { restockId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'restocks:manage')
        const supabase = getSupabaseAdmin()

        // only the deletetion of inapplied restock
        const { data: restock, error: fetchError } = await supabase
            .from('session_restocks')
            .select('id, applied')
            .eq('id', restockId)
            .single()

        if (fetchError || !restock) return errorResponse('RESTOCK_NOT_FOUND', 404)
        if (restock.applied)       return errorResponse('RESTOCK_ALREADY_APPLIED', 409)

        const { error } = await supabase
            .from('session_restocks')
            .update({ is_active: false })
            .eq('id', restockId)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
