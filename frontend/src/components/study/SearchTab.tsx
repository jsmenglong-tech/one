'use client'
import { useState, useRef } from 'react'
import { searchKnowledge } from '@/lib/api'
import ExplainModal from './ExplainModal'

const DIFFICULTY_LABEL: Record<number, string> = { 1: '很易', 2: '易', 3: '中', 4: '难', 5: '很难' }
const DIFFICULTY_COLOR: Record<number, string> = {
  1: 'bg-green-100 text-green-600',
  2: 'bg-green-100 text-green-600',
  3: 'bg-yellow-100 text-yellow-600',
  4: 'bg-red-100 text-red-600',
  5: 'bg-red-100 text-red-600',
}

export default function SearchTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [explainKp, setExplainKp] = useState<{ title: string; content: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function doSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setSearched(false)
    setExpanded(null)
    try {
      const d = await searchKnowledge(q, 20)
      setResults(d.results)
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') doSearch()
  }

  return (
    <>
      {explainKp && (
        <ExplainModal kp={explainKp} onClose={() => setExplainKp(null)} />
      )}

      <div className="space-y-4">
        {/* 搜索框 */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入关键词搜索知识点，例如：施工组织设计、安全生产..."
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200"
            />
            <button
              onClick={doSearch}
              disabled={loading || !query.trim()}
              className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">支持标题和内容全文搜索，按 Enter 快速搜索</p>
        </div>

        {/* 搜索结果 */}
        {loading && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            搜索中...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            未找到与「{query}」相关的知识点
          </div>
        )}

        {!loading && searched && results.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-400 px-1 mb-2">
              共找到 <span className="font-medium text-gray-600">{results.length}</span> 条结果
            </div>
            {results.map((kp: any) => (
              <div key={kp.id} className="bg-white rounded-xl shadow">
                <button
                  className="w-full text-left p-4 flex items-center justify-between"
                  onClick={() => setExpanded(expanded === kp.id ? null : kp.id)}
                >
                  <div className="font-medium text-gray-800 text-sm">{kp.title}</div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[kp.difficulty] ?? 'bg-gray-100 text-gray-500'}`}>
                      {DIFFICULTY_LABEL[kp.difficulty] ?? '未知'}
                    </span>
                    <span className="text-gray-400 text-xs">{expanded === kp.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === kp.id && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{kp.content}</p>

                    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                      {/* 标签 */}
                      <div className="flex gap-1 flex-wrap">
                        {kp.tags?.map((t: string) => (
                          <span key={t} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>

                      {/* AI 解释按钮 */}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setExplainKp({ title: kp.title, content: kp.content })
                        }}
                        className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex-shrink-0"
                      >
                        <span>🤖</span>
                        <span>让 AI 解释这个概念</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!searched && !loading && (
          <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400 text-sm">
            输入关键词后点击搜索，找到知识点后可让 AI 为你详细解释
          </div>
        )}
      </div>
    </>
  )
}
