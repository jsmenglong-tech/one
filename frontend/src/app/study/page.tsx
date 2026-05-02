'use client'
import { useState, useEffect } from 'react'
import BrowseTab from '@/components/study/BrowseTab'
import PracticeTab from '@/components/study/PracticeTab'
import WrongTab from '@/components/study/WrongTab'
import SearchTab from '@/components/study/SearchTab'
import LoginModal from '@/components/common/LoginModal'
import { isStudyLoggedIn, clearStudyToken } from '@/lib/auth'

const TABS = [
  { key: 'search', label: '🔍 知识搜索' },
  { key: 'browse', label: '章节浏览' },
  { key: 'practice', label: '做题练习' },
  { key: 'wrong', label: '错题回顾' },
]

export default function StudyPage() {
  const [tab, setTab] = useState('search')
  const [loggedIn, setLoggedIn] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setLoggedIn(isStudyLoggedIn())
    setChecking(false)
  }, [])

  if (checking) return null

  if (!loggedIn) {
    return <LoginModal role="study" onSuccess={() => setLoggedIn(true)} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-800 text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-green-300 hover:text-white text-sm">← 首页</a>
          <h1 className="text-xl font-bold">学习端</h1>
        </div>
        <button
          onClick={() => { clearStudyToken(); setLoggedIn(false) }}
          className="text-green-300 hover:text-white text-sm"
        >
          退出登录
        </button>
      </header>
      <div className="flex border-b bg-white shadow-sm">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              tab === t.key
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-6 max-w-4xl mx-auto">
        {tab === 'search' && <SearchTab />}
        {tab === 'browse' && <BrowseTab />}
        {tab === 'practice' && <PracticeTab />}
        {tab === 'wrong' && <WrongTab />}
      </div>
    </div>
  )
}
