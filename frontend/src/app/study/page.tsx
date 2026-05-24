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
    <div className="min-h-screen">
      {/* 顶部品牌栏 */}
      <header className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white">
        <div className="absolute inset-0 bg-mesh-emerald opacity-40 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="inline-flex items-center gap-1.5 text-emerald-100 hover:text-white text-sm transition-colors">
              <span aria-hidden>←</span> 首页
            </a>
            <div className="h-5 w-px bg-white/20" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center text-base">📖</div>
              <h1 className="text-lg font-bold tracking-wide">学习端</h1>
            </div>
          </div>
          <button
            onClick={() => { clearStudyToken(); setLoggedIn(false) }}
            className="text-xs text-emerald-100 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      {/* 胶囊 Tab */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 overflow-x-auto">
          <div className="inline-flex items-center gap-1 bg-gray-100/70 p-1 rounded-xl">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  tab === t.key
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto animate-fade-in">
        {tab === 'search' && <SearchTab />}
        {tab === 'browse' && <BrowseTab />}
        {tab === 'practice' && <PracticeTab />}
        {tab === 'wrong' && <WrongTab />}
      </div>
    </div>
  )
}
