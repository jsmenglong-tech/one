import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '一建知识库系统',
  description: '一级建造师实务知识库管理与出题系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
