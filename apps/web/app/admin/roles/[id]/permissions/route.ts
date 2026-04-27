import { NextRequest } from 'next/server'
import { verifyAdmin, assertPermission } from '@/lib/auth/verifyAdmin'
import { errorResponse } from '@/lib/api/response'
import { getSupabaseAdmin } from '@/lib/supabase/server'

const OWNER_ROLE_ID = '00000000-0000-0000-0000-000000000001'

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: roleId } = await params
        const ctx = await verifyAdmin(req)
        assertPermission(ctx, 'roles:manage')

        const supabase = getSupabaseAdmin()
        const { permissionIds } = await req.json()  // complete id list

        // owner role protection: check roles:manage in permissionIds
        if (roleId === OWNER_ROLE_ID) {
            const { data: rolesManagePerm } = await supabase
                .from('permissions')
                .select('id')
                .eq('key', 'roles:manage')
                .single()

            if (rolesManagePerm && !permissionIds.includes(rolesManagePerm.id)) {
                return errorResponse('CANNOT_DELETE_OWNER_ROLE', 400)
            }
        }

        // 1. delete permission of the current user
        const { error: deleteError } = await supabase
            .from('role_permissions')
            .delete()
            .eq('role_id', roleId)

        if (deleteError) throw new Error(deleteError.message)

        // 2. insert new permissions
        if (permissionIds.length > 0) {
            const rows = permissionIds.map((permissionId: string) => ({
                role_id: roleId,
                permission_id: permissionId,
            }))

            const { error: insertError } = await supabase
                .from('role_permissions')
                .insert(rows)

            if (insertError) throw new Error(insertError.message)
        }

        return Response.json({ data: { success: true } })
    } catch (e: any) {
        return errorResponse(e.message)
    }
}
