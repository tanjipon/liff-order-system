import { NextRequest } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        await verifyAdmin(req)
        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase
            .from('permissions')
            .select('id, key, name')
            .order('key', { ascending: true })

        if (error) throw new Error(error.message)

        return Response.json({ data })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
