'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/auth/adminClient'
import AdminSpinner from '@/components/admin/AdminSpinner'
import { useMinLoading } from '@/hooks/useMinLoading'

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

const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
    border: { borderColor: 'var(--color-admin-border)' },
} as const

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([])
    const [allPermissions, setAllPermissions] = useState<Permission[]>([])
    const [dataLoaded, setDataLoaded] = useState(false)
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
    const [editPermIds, setEditPermIds] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    const { combine } = useMinLoading(1000)
    const isLoading = combine(dataLoaded)

    async function loadData() {
        const [rolesRes, permsRes] = await Promise.all([
            adminFetch('/api/admin/roles'),
            adminFetch('/api/admin/permissions'),
        ])
        const rolesBody = await rolesRes.json()
        const permsBody = await permsRes.json()
        setRoles(rolesBody.data ?? [])
        setAllPermissions(permsBody.data ?? [])
        setDataLoaded(true)
    }

    useEffect(() => { loadData() }, [])

    function startEdit(role: Role) {
        setEditingRoleId(role.id)
        setEditPermIds(role.role_permissions.map(rp => rp.permissions.id))
        setSaveError(null)
    }

    function togglePerm(permId: string) {
        setEditPermIds(prev =>
            prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
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

    if (isLoading) return <AdminSpinner />

    return (
        <div className="p-6 max-w-3xl mx-auto">

            {/* 頁首 */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold" style={css.text}>角色管理</h1>
                    <p className="text-sm mt-0.5" style={css.muted}>{roles.length} 個角色</p>
                </div>
                <Link
                    href="/admin/roles/new"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-admin-primary)' }}
                >
                    新增角色
                </Link>
            </div>

            {roles.length === 0 ? (
                <div className="rounded-xl border p-12 text-center" style={css.surface}>
                    <p className="text-sm" style={css.muted}>尚無角色資料</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {roles.map(role => (
                        <div key={role.id} className="rounded-xl border p-5" style={css.surface}>

                            {/* 角色標題列 */}
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-semibold text-sm" style={css.text}>{role.name}</h2>
                                {editingRoleId === role.id ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSave(role.id)}
                                            disabled={saving}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                                            style={{ backgroundColor: 'var(--color-admin-primary)' }}
                                        >
                                            {saving ? '儲存中...' : '儲存'}
                                        </button>
                                        <button
                                            onClick={() => setEditingRoleId(null)}
                                            className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
                                            style={css.surface}
                                        >
                                            <span style={css.muted}>取消</span>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => startEdit(role)}
                                        className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
                                        style={css.surface}
                                    >
                                        <span style={css.muted}>編輯權限</span>
                                    </button>
                                )}
                            </div>

                            {/* 權限列表 / 編輯 */}
                            {editingRoleId === role.id ? (
                                <div className="space-y-3">
                                    {saveError && (
                                        <p className="text-xs" style={{ color: '#DC2626' }}>{saveError}</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        {allPermissions.map(perm => (
                                            <label key={perm.id}
                                                className="flex items-center gap-2.5 text-sm cursor-pointer p-2 rounded-lg border"
                                                style={{
                                                    borderColor: editPermIds.includes(perm.id)
                                                        ? 'var(--color-admin-primary)'
                                                        : 'var(--color-admin-border)',
                                                    backgroundColor: editPermIds.includes(perm.id)
                                                        ? '#EFF6FF'
                                                        : 'var(--color-admin-surface)',
                                                }}>
                                                <input
                                                    type="checkbox"
                                                    checked={editPermIds.includes(perm.id)}
                                                    onChange={() => togglePerm(perm.id)}
                                                    className="accent-blue-600"
                                                />
                                                <span className="text-xs" style={css.text}>{perm.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {role.role_permissions.length === 0 ? (
                                        <p className="text-xs" style={css.muted}>尚無權限</p>
                                    ) : (
                                        role.role_permissions.map((rp, i) => (
                                            <span key={i}
                                                className="text-xs px-2.5 py-1 rounded-full font-medium"
                                                style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                                                {rp.permissions.name}
                                            </span>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
