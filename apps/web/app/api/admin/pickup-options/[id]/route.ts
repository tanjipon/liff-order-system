import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'pickup_options:manage')

        const supabase = getSupabaseAdmin()
        const { name, description, extraFee, allowedPaymentMethods } = await req.json()

        const updates: Record<string, unknown> = {}
        if (name !== undefined)                    updates.name = name
        if (description !== undefined)             updates.description = description
        if (extraFee !== undefined)                updates.extra_fee = extraFee
        if (allowedPaymentMethods !== undefined)   updates.allowed_payment_methods = allowedPaymentMethods

        if (Object.keys(updates).length === 0) {
            return errorResponse('MISSING_FIELDS', 400)
        }

        const { error } = await supabase
            .from('pickup_options')
            .update(updates)
            .eq('id', id)

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
