'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/auth/adminClient'

type Permission = {
    id: string
    key: string
    name: string
}

type Role = {
    id: string
    name: string
    role_permissions: { permissions: Permission }[]
}

type AllPermission = {
    id: string
    key: string
    name: string
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([])
    const [allPermissions, setAllPermissions] = useState<AllPermission[]>([])
    const [loading, setLoading] = useState(true)
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
    const [editPermIds, setEditPermIds] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    async function loadData() {
        const [rolesRes, permsRes] = await Promise.all([
            adminFetch('/api/admin/roles'),
            adminFetch('/api/admin/permissions'),
        ])
        const rolesBody = await rolesRes.json()
        const permsBody = await permsRes.json()
        setRoles(rolesBody.data ?? [])
        setAllPermissions(permsBody.data ?? [])
        setLoading(false)
    }

    useEffect(() => { loadData() }, [])

    function startEdit(role: Role) {
        const currentPermIds = role.role_permissions.map(rp => rp.permissions.id)
        setEditingRoleId(role.id)
        setEditPermIds(currentPermIds)
        setSaveError(null)
    }

    function togglePerm(permId: string) {
        setEditPermIds(prev =>
            prev.includes(permId)
                ? prev.filter(id => id !== permId)
                : [...prev, permId]
        )
    }

    async function handleSave(roleId: string) {
        setSaving(true)
        setSaveError(null)
        try {
            const res = await adminFetch(`/api/admin/roles/${roleId}/permissions`, {
                method: 'PATCH',
                body: JSON.stringify({ permissionIds: editPermIds }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error ?? '儲存失敗')
            setEditingRoleId(null)
            loadData()
        } catch (e: any) {
            setSaveError(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-6">載入中...</div>

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">角色管理</h1>
                <Link
                    href="/admin/roles/new"
                    className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
                >
                    新增角色
                </Link>
            </div>

            <div className="space-y-4">
                {roles.map(role => (
                    <div key={role.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-semibold">{role.name}</h2>
                            {editingRoleId === role.id ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleSave(role.id)}
                                        disabled={saving}
                                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                                    >
                                        {saving ? '儲存中...' : '儲存'}
                                    </button>
                                    <button
                                        onClick={() => setEditingRoleId(null)}
                                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                                    >
                                        取消
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => startEdit(role)}
                                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                                >
                                    編輯權限
                                </button>
                            )}
                        </div>

                        {editingRoleId === role.id ? (
                            <div className="space-y-2">
                                {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
                                <div className="grid grid-cols-2 gap-2">
                                    {allPermissions.map(perm => (
                                        <label key={perm.id} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={editPermIds.includes(perm.id)}
                                                onChange={() => togglePerm(perm.id)}
                                            />
                                            <span>{perm.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {role.role_permissions.length === 0 ? (
                                    <p className="text-sm text-gray-400">尚無權限</p>
                                ) : (
                                    role.role_permissions.map((rp, i) => (
                                        <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                            {rp.permissions.name}
                                        </span>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
