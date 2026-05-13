import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')
        const supabase = getSupabaseAdmin()

        const { data, error } = await supabase.from('settings').select('key, value')
        if (error) throw new Error(error.message)

        const settings: Record<string, string> = {}
        data.forEach(row => { settings[row.key] = row.value })
        return Response.json({ data: settings })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'sessions:edit')
        const supabase = getSupabaseAdmin()

        const body = await req.json() as Record<string, string>
        const rows = Object.entries(body).map(([key, value]) => ({ key, value }))

        const { error } = await supabase
            .from('settings')
            .upsert(rows, { onConflict: 'key' })

        if (error) throw new Error(error.message)
        return Response.json({ data: { ok: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
