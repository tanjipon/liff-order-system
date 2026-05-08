import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('settings').select('key, value')
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const settings: Record<string, string> = {}
    data.forEach(row => { settings[row.key] = row.value })
    return Response.json({ data: settings })
}
