const css = {
    surface: { backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-border)' },
    text: { color: 'var(--color-admin-text)' },
    muted: { color: 'var(--color-admin-muted)' },
} as const

type Props = {
    page: number
    totalPages: number
    total: number
    limit: number
    onChange: (page: number) => void
}

export default function Pagination({ page, totalPages, total, limit, onChange }: Props) {
    if (totalPages <= 1) return null

    const from = (page - 1) * limit + 1
    const to = Math.min(page * limit, total)

    // Show at most 5 page buttons around current page
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
        pages.push(1)
        if (page > 3) pages.push('...')
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
            pages.push(i)
        }
        if (page < totalPages - 2) pages.push('...')
        pages.push(totalPages)
    }

    return (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <p className="text-xs" style={css.muted}>
                顯示第 {from}–{to} 筆，共 {total} 筆
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onChange(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs border disabled:opacity-40"
                    style={css.surface}
                >
                    <span style={css.muted}>← 上一頁</span>
                </button>

                {pages.map((p, i) =>
                    p === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 text-xs" style={css.muted}>…</span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onChange(p as number)}
                            className="w-8 h-8 rounded-lg text-xs font-medium border"
                            style={p === page
                                ? { backgroundColor: 'var(--color-admin-primary)', color: '#fff', borderColor: 'var(--color-admin-primary)' }
                                : css.surface
                            }
                        >
                            <span style={p === page ? {} : css.muted}>{p}</span>
                        </button>
                    )
                )}

                <button
                    onClick={() => onChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs border disabled:opacity-40"
                    style={css.surface}
                >
                    <span style={css.muted}>下一頁 →</span>
                </button>
            </div>
        </div>
    )
}
