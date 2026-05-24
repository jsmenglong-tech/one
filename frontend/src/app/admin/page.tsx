'use client'
import { useState, useEffect } from 'react'
import ImportTab from '@/components/admin/ImportTab'
import KnowledgeTab from '@/components/admin/KnowledgeTab'
import QuestionTab from '@/components/admin/QuestionTab'
import ExportTab from '@/components/admin/ExportTab'
import AccountTab from '@/components/admin/AccountTab'
import LoginModal from '@/components/common/LoginModal'
import { isAdminLoggedIn, clearAdminToken } from '@/lib/auth'

const TABS = [
  { key: 'import', label: '导入内容' },
  { key: 'knowledge', label: '知识点管理' },
  { key: 'question', label: '出题管理' },
  { key: 'export', label: '导出/导入知识库' },
  { key: 'account', label: '账号管理' },
]

export default function AdminPage() {
  const [tab, setTab] = useState('import')
  const [loggedIn, setLoggedIn] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setLoggedIn(isAdminLoggedIn())
    setChecking(false)
  }, [])

  if (checking) return null

  if (!loggedIn) {
    return <LoginModal role="admin" onSuccess={() => setLoggedIn(true)} />
  }

  return (
    <div className="min-h-screen">
      {/* 顶部品牌栏 */}
      <header className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white">
        <div className="absolute inset-0 bg-mesh-indigo opacity-40 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="inline-flex items-center gap-1.5 text-indigo-100 hover:text-white text-sm transition-colors">
              <span aria-hidden>←</span> 首页
            </a>
            <div className="h-5 w-px bg-white/20" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center text-base">🗂️</div>
              <h1 className="text-lg font-bold tracking-wide">管理后台</h1>
            </div>
          </div>
          <button
            onClick={() => { clearAdminToken(); setLoggedIn(false) }}
            className="text-xs text-indigo-100 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* 胶囊 Tab */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 overflow-x-auto">
          <div className="inline-flex items-center gap-1 bg-gray-100/70 p-1 rounded-xl">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  tab === t.key
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto animate-fade-in">
        {tab === 'import' && <ImportTab />}
        {tab === 'knowledge' && <KnowledgeTab />}
        {tab === 'question' && <QuestionTab />}
        {tab === 'export' && <ExportTab />}
        {tab === 'account' && <AccountTab />}
      </div>
    </div>
  )
}
