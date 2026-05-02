'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center mb-10">
        <h1 className="text-4xl font-bold text-blue-900 mb-3">一建知识库系统</h1>
        <p className="text-gray-600 text-lg">一级建造师实务知识结构化管理与智能出题平台</p>
      </div>
      <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
        <Link href="/admin" className="bg-white rounded-2xl shadow-md p-8 hover:shadow-xl transition-shadow border border-blue-100 flex flex-col items-center">
          <span className="text-4xl mb-3">🗂️</span>
          <h2 className="text-xl font-bold text-gray-800 mb-1">管理后台</h2>
          <p className="text-gray-500 text-sm text-center">上传内容、管理知识点、生成题目、导出知识库</p>
        </Link>
        <Link href="/study" className="bg-white rounded-2xl shadow-md p-8 hover:shadow-xl transition-shadow border border-green-100 flex flex-col items-center">
          <span className="text-4xl mb-3">📖</span>
          <h2 className="text-xl font-bold text-gray-800 mb-1">学习端</h2>
          <p className="text-gray-500 text-sm text-center">章节浏览、做题练习、查看解析、错题回顾</p>
        </Link>
      </div>
    </div>
  )
}
