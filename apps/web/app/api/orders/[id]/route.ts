import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT (
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const profile = await verifyLiffToken(req)
        const { items } = await req.json()

        const { error } = await supabase.rpc('update_order', {
            p_order_id:     params.id,
            p_line_user_id: profile.userId,
            p_items:        items
        })

        if (error) throw new Error(error.message)

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}