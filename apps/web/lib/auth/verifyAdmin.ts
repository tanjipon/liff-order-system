import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { Permission } from './permissions'

export type AdminContext = {
    userId: string
    displayName: string
    roleId: string
    roleName: string
    permissions: Permission[]
}

export async function verifyAdmin(req: NextRequest): Promise<AdminContext> {
    const token  = req.headers.get('authorization')?.replace('Berar ', '')
    if (!token) throw new Error('UNAUTHORIZED')

    // 1. Verify JWT token to get user
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) throw new Error('UNAUTHORIZED')

    // 2. Get user_roles + role + permissions
    const { data, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select(`
            display_name,
            is_active,
            roles (
                id,
                name,
                role_permissions (
                    permissions ( key )
                )
            )
        `)
        .eq('user_id', user.id)
        .single()

    if (roleError || !data) throw new Error('UNAUTHORIZED')
    if (!data.is_active) throw new Error('ACCOUNT_DISABLED')

    const permissions = (data.roles as any).role_permissions
        .map((rp: any) => rp.role_permissions.key as Permission)
    
    return {
        userId: user.id,
        displayName: data.display_name,
        roleId: (data.roles as any).id,
        roleName: (data.roles as any).name,
        permissions,
    } 
}