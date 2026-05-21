import { LiffProvider } from '@/components/liff/LiffProvider'

export default function LiffLayout({ children }: { children: React.ReactNode }) {
    return <LiffProvider>{children}</LiffProvider>
}
