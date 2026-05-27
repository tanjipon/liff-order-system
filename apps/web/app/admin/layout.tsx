'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { adminFetch, adminSignOut } from '@/lib/auth/adminClient'

const NAV_ITEMS = [
    { href: '/admin', label: '訂單管理' },
    { href: '/admin/sessions', label: '開單管理' },
    { href: '/admin/orders', label: '歷史訂單' },
    { href: '/admin/pickup-options', label: '取貨方式' },
    { href: '/admin/staff', label: '人員管理' },
    { href: '/admin/roles', label: '角色權限' },
    { href: '/admin/images', label: '圖庫管理' },
    { href: '/admin/settings', label: '系統設定' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [shopName, setShopName] = useState('後台管理系統')

    useEffect(() => {
        if (pathname === '/admin/login') return
        adminFetch('/api/admin/settings')
            .then(r => r.json())
            .then(body => { if (body.data?.shop_name) setShopName(body.data.shop_name) })
            .catch(() => {})
    }, [pathname])

    // login do not use layout
    if (pathname === '/admin/login') return <>{children}</>

    return (
        <div className="min-h-screen flex flex-col md:flex-row" style={{ backgroundColor: 'var(--color-admin-bg)' }}>

            {/* 手機：頂部導覽列 */}
            <nav className="md:hidden border-b px-4 py-3 flex items-center gap-2 overflow-x-auto shrink-0"
                style={{ backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' }}>
                {NAV_ITEMS.map(item => {
                    const isActive = item.href === '/admin'
                        ? pathname === '/admin'
                        : pathname.startsWith(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${isActive
                                ? 'font-semibold'
                                : 'font-normal text-[var(--color-admin-muted)] hover:bg-gray-100 hover:text-gray-600'
                            }`}
                            style={{
                                backgroundColor: isActive ? 'var(--color-admin-sidebar-active)' : undefined,
                                color: isActive ? 'var(--color-admin-primary)' : undefined,
                            }}
                        >
                            {item.label}
                        </Link>
                    )
                })}
                <button
                    onClick={adminSignOut}
                    className="shrink-0 ml-auto p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    title="登出"
                    style={{ color: 'var(--color-admin-muted)' }}
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </nav>

            {/* 桌機：側邊欄 */}
            <aside className="hidden md:flex w-56 shrink-0 border-r flex-col"
                style={{ backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-admin-border)' }}>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-admin-text)' }}>
                        {shopName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-admin-muted)' }}>
                        後台管理系統
                    </p>
                </div>
                <nav className="flex-1 py-2">
                    {NAV_ITEMS.map(item => {
                        const isActive = item.href === '/admin'
                            ? pathname === '/admin'
                            : pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center px-4 py-2 text-sm transition-colors ${isActive
                                    ? 'font-semibold'
                                    : 'font-normal text-[var(--color-admin-muted)] hover:bg-gray-100 hover:text-gray-600'
                                }`}
                                style={{
                                    backgroundColor: isActive ? 'var(--color-admin-sidebar-active)' : undefined,
                                    color: isActive ? 'var(--color-admin-primary)' : undefined,
                                }}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
                <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--color-admin-border)' }}>
                    <button
                        onClick={adminSignOut}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100"
                        style={{ color: 'var(--color-admin-muted)' }}
                    >
                        <LogOut className="w-4 h-4" />
                        登出
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main id="admin-main" className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    )
}
