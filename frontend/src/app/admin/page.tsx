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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-900 text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-blue-300 hover:text-white text-sm">← 首页</a>
          <h1 className="text-xl font-bold">管理后台</h1>
        </div>
        <button
          onClick={() => { clearAdminToken(); setLoggedIn(false) }}
          className="text-blue-300 hover:text-white text-sm"
        >
          退出登录
        </button>
      </header>
      <div className="flex border-b bg-white shadow-sm overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-6 max-w-5xl mx-auto">
        {tab === 'import' && <ImportTab />}
        {tab === 'knowledge' && <KnowledgeTab />}
        {tab === 'question' && <QuestionTab />}
        {tab === 'export' && <ExportTab />}
        {tab === 'account' && <AccountTab />}
      </div>
    </div>
  )
}
