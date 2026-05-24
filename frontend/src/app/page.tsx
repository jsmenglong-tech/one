'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute inset-0 bg-mesh-indigo pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/40 to-violet-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* 品牌头部 */}
      <div className="relative max-w-3xl w-full text-center mb-12 animate-slide-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-white/70 backdrop-blur border border-indigo-100 text-xs font-medium text-indigo-700 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          AI 驱动的一建知识库与智能出题平台
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 leading-tight">
          <span className="text-gradient-indigo">一建知识库</span>
          <span className="text-gray-900">系统</span>
        </h1>
        <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto">
          一级建造师实务知识结构化管理 · 智能出题 · 错题回顾 · AI 答疑
        </p>
      </div>

      {/* 入口卡片 */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl animate-slide-up" style={{ animationDelay: '120ms' }}>
        <Link
          href="/admin"
          className="group relative card-surface card-hover overflow-hidden p-8 flex flex-col"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/60 via-transparent to-violet-50/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-indigo-200 to-violet-200 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" />
          <div className="relative flex items-center justify-between mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/30">
              🗂️
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">管理员</span>
          </div>
          <h2 className="relative text-2xl font-bold text-gray-900 mb-2">管理后台</h2>
          <p className="relative text-gray-500 text-sm leading-relaxed mb-6">
            上传内容、管理知识点、生成题目、导出知识库
          </p>
          <div className="relative mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 group-hover:gap-2.5 transition-all">
            进入管理后台
            <span aria-hidden>→</span>
          </div>
        </Link>

        <Link
          href="/study"
          className="group relative card-surface card-hover overflow-hidden p-8 flex flex-col"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 via-transparent to-teal-50/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" />
          <div className="relative flex items-center justify-between mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/30">
              📖
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">学员</span>
          </div>
          <h2 className="relative text-2xl font-bold text-gray-900 mb-2">学习端</h2>
          <p className="relative text-gray-500 text-sm leading-relaxed mb-6">
            知识搜索、章节浏览、做题练习、错题回顾
          </p>
          <div className="relative mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 group-hover:gap-2.5 transition-all">
            进入学习端
            <span aria-hidden>→</span>
          </div>
        </Link>
      </div>

      {/* 页脚 */}
      <div className="relative mt-16 text-xs text-gray-400 animate-fade-in" style={{ animationDelay: '300ms' }}>
        Powered by Next.js · FastAPI · DeepSeek
      </div>
    </div>
  )
}
