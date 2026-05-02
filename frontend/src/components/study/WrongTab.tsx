'use client'
import { useState, useEffect, useMemo } from 'react'
import { getWrongRecords } from '@/lib/api'

interface WrongItem {
  question_id: string
  wrong_count: number
  last_wrong_at: string | null
  question: {
    id: string
    type: string
    question: string
    options: Record<string, string> | null
    answer: string
    analysis: string
  }
  chapter_id: number | null
  chapter_title: string | null
  subject_id: number | null
  subject_title: string | null
}

export default function WrongTab() {
  const [records, setRecords] = useState<WrongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)

  useEffect(() => {
    getWrongRecords().then(r => {
      setRecords(r.items)
      setLoading(false)
    })
  }, [])

  // 提取所有科目（去重）
  const subjects = useMemo(() => {
    const map = new Map<number, string>()
    records.forEach(r => {
      if (r.subject_id != null && r.subject_title) {
        map.set(r.subject_id, r.subject_title)
      }
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [records])

  // 根据选中科目，提取章节（去重）
  const chapters = useMemo(() => {
    if (selectedSubject == null) return []
    const map = new Map<number, string>()
    records.forEach(r => {
      if (r.subject_id === selectedSubject && r.chapter_id != null && r.chapter_title) {
        map.set(r.chapter_id, r.chapter_title)
      }
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [records, selectedSubject])

  // 过滤后的错题列表
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (selectedSubject != null && r.subject_id !== selectedSubject) return false
      if (selectedChapter != null && r.chapter_id !== selectedChapter) return false
      return true
    })
  }, [records, selectedSubject, selectedChapter])

  const handleSubjectClick = (id: number) => {
    if (selectedSubject === id) {
      setSelectedSubject(null)
      setSelectedChapter(null)
    } else {
      setSelectedSubject(id)
      setSelectedChapter(null)
    }
  }

  const handleChapterClick = (id: number) => {
    setSelectedChapter(selectedChapter === id ? null : id)
  }

  if (loading) return <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">加载中...</div>
  if (records.length === 0) return (
    <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
      <div className="text-4xl mb-3">🎉</div>
      <div>暂无错题记录，继续加油！</div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 科目筛选 */}
      {subjects.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-2 font-medium">按科目筛选</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedSubject(null); setSelectedChapter(null) }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                selectedSubject == null
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              全部 ({records.length})
            </button>
            {subjects.map(s => {
              const count = records.filter(r => r.subject_id === s.id).length
              return (
                <button
                  key={s.id}
                  onClick={() => handleSubjectClick(s.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedSubject === s.id
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {s.title} ({count})
                </button>
              )
            })}
          </div>

          {/* 章节筛选（选中科目后显示） */}
          {selectedSubject != null && chapters.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-2 font-medium">按章节筛选</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedChapter(null)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedChapter == null
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  全部章节
                </button>
                {chapters.map(c => {
                  const count = records.filter(r => r.subject_id === selectedSubject && r.chapter_id === c.id).length
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleChapterClick(c.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        selectedChapter === c.id
                          ? 'bg-indigo-500 text-white border-indigo-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {c.title} ({count})
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 错题列表 */}
      <div className="text-sm text-gray-500">
        共 <span className="font-medium text-gray-700">{filtered.length}</span> 道错题
        {(selectedSubject != null || selectedChapter != null) && (
          <span className="ml-2 text-xs text-gray-400">（已筛选）</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
          该范围内暂无错题
        </div>
      ) : (
        filtered.map(r => {
          const q = r.question
          return (
            <div key={r.question_id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">错 {r.wrong_count} 次</span>
                <span className="text-xs text-gray-400">最近：{r.last_wrong_at ? new Date(r.last_wrong_at).toLocaleDateString() : '-'}</span>
                {r.subject_title && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{r.subject_title}</span>
                )}
                {r.chapter_title && (
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{r.chapter_title}</span>
                )}
              </div>
              <p className="text-sm text-gray-800 font-medium mb-2">{q.question}</p>
              {q.options && (
                <div className="space-y-1 mb-2">
                  {Object.entries(q.options).map(([k, v]) => (
                    <div key={k} className={`text-xs px-3 py-1 rounded ${k === q.answer ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500'}`}>
                      {k}. {v}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-blue-600 bg-blue-50 rounded p-2">
                <span className="font-medium">解析：</span>{q.analysis}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
