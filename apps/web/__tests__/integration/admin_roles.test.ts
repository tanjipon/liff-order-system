import { vi } from 'vitest'

vi.mock('@/lib/auth/verifyAdmin', () => ({
    verifyAdmin: vi.fn().mockResolvedValue({
        userId:      'admin-test-user',
        displayName: 'test admin',
        roleId:      '00000000-0000-0000-0000-000000000001',
        roleName:    'owner',
        permissions: ['roles:manage'],
    }),
    assertPermission: vi.fn(),
}))

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { GET as getRoles, POST as createRole } from '@/app/api/admin/roles/route'
import { PATCH as updatePermissions } from '@/app/api/admin/roles/[id]/permissions/route'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function adminReq(url: string, method = 'GET', body?: object) {
    return new NextRequest(url, {
        method,
        headers: {
            Authorization: 'Bearer mock',
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    })
}

let newRoleId: string
let ordersAcceptPermId: string
let rolesManagePermId: string

beforeAll(async () => {
    // get test permission id
    const { data: perms } = await supabase
        .from('permissions')
        .select('id, key')
        .in('key', ['orders:accept', 'roles:manage'])

    ordersAcceptPermId = perms!.find(p => p.key === 'orders:accept')!.id
    rolesManagePermId  = perms!.find(p => p.key === 'roles:manage')!.id
})

describe('GET /admin/roles', () => {
    it('list all roles and permissions', async () => {
        const req = adminReq('http://localhost/api/admin/roles')
        const res = await getRoles(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(Array.isArray(body.data)).toBe(true)
        // 管理員 must exist
        expect(body.data.some((r: any) => r.name === '管理員')).toBe(true)
    })
})

describe('POST /admin/roles', () => {
    it('create role', async () => {
        const roleName = `test-role-${Date.now()}`
        const req = adminReq('http://localhost/api/admin/roles', 'POST', { name: roleName })
        const res = await createRole(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.roleId).toBeDefined()
        newRoleId = body.data.roleId
    })

    it('duplicated role name: return ROLE_ALREADY_EXISTS', async () => {
        const req = adminReq('http://localhost/api/admin/roles', 'POST', { name: '管理員' })
        const res = await createRole(req)
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toBe('ROLE_ALREADY_EXISTS')
    })
})

describe('PATCH /admin/roles/:id/permissions', () => {
    it('set permissions of the new user', async () => {
        const req = adminReq(
            `http://localhost/api/admin/roles/${newRoleId}/permissions`,
            'PATCH',
            { permissionIds: [ordersAcceptPermId] }
        )
        const res = await updatePermissions(req, { params: Promise.resolve({ id: newRoleId }) })
        expect(res.status).toBe(200)

        // check record interted in DB
        const { data } = await supabase
            .from('role_permissions')
            .select('permission_id')
            .eq('role_id', newRoleId)

        expect(data?.length).toBe(1)
        expect(data![0].permission_id).toBe(ordersAcceptPermId)
    })

    it('移除 owner 的 roles:manage：回傳 CANNOT_DELETE_OWNER_ROLE', async () => {
        const OWNER_ROLE_ID = '00000000-0000-0000-0000-000000000001'
        const req = adminReq(
            `http://localhost/api/admin/roles/${OWNER_ROLE_ID}/permissions`,
            'PATCH',
            { permissionIds: [ordersAcceptPermId] }  // no roles:manage
        )
        const res = await updatePermissions(req, { params: Promise.resolve({ id: OWNER_ROLE_ID }) })
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toBe('CANNOT_DELETE_OWNER_ROLE')
    })
})
