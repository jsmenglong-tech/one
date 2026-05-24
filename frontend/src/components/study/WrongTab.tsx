'use client'
import { useState, useEffect, useMemo } from 'react'
import { getWrongRecords, recordWrong } from '@/lib/api'

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

// ── 单题错题练习卡片 ───────────────────────────────────────────────────────────
function WrongQuestionCard({
  record,
  index,
  total,
  onWrongCountUpdate,
}: {
  record: WrongItem
  index: number
  total: number
  onWrongCountUpdate: (questionId: string, newCount: number) => void
}) {
  const q = record.question
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localWrongCount, setLocalWrongCount] = useState(record.wrong_count)

  const isMultiple = q.type === 'multiple'
  const correctAnswers = q.answer ? q.answer.split('') : []

  function toggleOption(key: string) {
    if (submitted) return
    if (isMultiple) {
      setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key])
    } else {
      setSelected([key])
    }
  }

  async function handleSubmit() {
    if (q.options && !selected.length) return
    setSubmitting(true)
    const isCorrect = isMultiple
      ? selected.sort().join('') === correctAnswers.sort().join('')
      : selected[0] === q.answer
    if (!isCorrect && q.options) {
      try {
        await recordWrong(q.id)
        const newCount = localWrongCount + 1
        setLocalWrongCount(newCount)
        onWrongCountUpdate(q.id, newCount)
      } catch {}
    }
    setSubmitted(true)
    setSubmitting(false)
  }

  function handleRetry() {
    setSelected([])
    setSubmitted(false)
  }

  function getOptionStyle(key: string) {
    if (!submitted) {
      return selected.includes(key)
        ? 'border-green-500 bg-green-50 text-green-800'
        : 'border-gray-200 hover:border-green-300 hover:bg-gray-50 text-gray-700'
    }
    const isCorrect = correctAnswers.includes(key)
    const isSelected = selected.includes(key)
    if (isCorrect) return 'border-green-500 bg-green-50 text-green-800'
    if (isSelected && !isCorrect) return 'border-red-400 bg-red-50 text-red-700'
    return 'border-gray-200 text-gray-400'
  }

  const isCorrectAnswer = submitted && (
    isMultiple
      ? selected.sort().join('') === correctAnswers.sort().join('')
      : selected[0] === q.answer
  )

  return (
    <div className="bg-white rounded-xl shadow p-6">
      {/* 头部：错误次数 + 最近时间 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
          错 {localWrongCount} 次
        </span>
        <span className="text-xs text-gray-400">
          最近：{record.last_wrong_at ? new Date(record.last_wrong_at).toLocaleDateString() : '-'}
        </span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
          {q.type === 'single' ? '单选题' : q.type === 'multiple' ? '多选题' : '案例题'}
        </span>
        <span className="ml-auto text-xs text-gray-400">第 {index + 1} / {total} 题</span>
      </div>

      {/* 题干 */}
      <p className="text-gray-800 font-medium mb-4 leading-relaxed">{q.question}</p>

      {/* 选项 */}
      {q.options && (
        <div className="space-y-2 mb-4">
          {Object.entries(q.options as Record<string, string>).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleOption(k)}
              className={`w-full text-left text-sm px-4 py-3 rounded-lg border transition-all ${getOptionStyle(k)}`}
            >
              <span className="font-medium mr-2">{k}.</span>{v}
            </button>
          ))}
        </div>
      )}

      {/* 案例题答案区 */}
      {!q.options && !submitted && (
        <div className="mb-3 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
          案例分析题，点击"查看答案"后显示参考答案和解析。
        </div>
      )}
      {!q.options && submitted && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
          <div className="font-medium text-gray-600 mb-1">参考答案：</div>
          {q.answer}
        </div>
      )}

      {/* 答题结果 */}
      {submitted && q.options && (
        <div className={`text-sm font-medium mb-2 ${isCorrectAnswer ? 'text-green-600' : 'text-red-500'}`}>
          {isCorrectAnswer ? '✓ 回答正确！' : `✗ 回答错误，正确答案：${q.answer}（错误次数已更新）`}
        </div>
      )}

      {/* 解析 */}
      {submitted && (
        <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-gray-600">
          <span className="font-medium text-blue-700">解析：</span>{q.analysis}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 mt-4">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || (q.options ? selected.length === 0 : false)}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : q.options ? (isMultiple ? `提交答案（已选 ${selected.length} 项）` : '提交答案') : '查看答案'}
          </button>
        ) : (
          q.options && (
            <button
              onClick={handleRetry}
              className="border border-gray-300 text-gray-600 px-6 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              再次作答
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── 主组件 ─────────────────────────────────────────────────────────────────────
export default function WrongTab() {
  const [records, setRecords] = useState<WrongItem[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<'select' | 'review'>('select')
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null) // null = 全部章节

  useEffect(() => {
    getWrongRecords().then(r => {
      setRecords(r.items || [])
      setLoading(false)
    })
  }, [])

  // 提取科目（去重 + 计数）
  const subjects = useMemo(() => {
    const map = new Map<number, { title: string; count: number }>()
    records.forEach(r => {
      if (r.subject_id != null && r.subject_title) {
        const cur = map.get(r.subject_id)
        if (cur) cur.count += 1
        else map.set(r.subject_id, { title: r.subject_title, count: 1 })
      }
    })
    return Array.from(map.entries()).map(([id, v]) => ({ id, title: v.title, count: v.count }))
  }, [records])

  // 选中科目下的章节（去重 + 计数）
  const chapters = useMemo(() => {
    if (selectedSubject == null) return []
    const map = new Map<number, { title: string; count: number }>()
    records.forEach(r => {
      if (r.subject_id === selectedSubject && r.chapter_id != null && r.chapter_title) {
        const cur = map.get(r.chapter_id)
        if (cur) cur.count += 1
        else map.set(r.chapter_id, { title: r.chapter_title, count: 1 })
      }
    })
    return Array.from(map.entries()).map(([id, v]) => ({ id, title: v.title, count: v.count }))
  }, [records, selectedSubject])

  // 当前回顾范围内的错题
  const reviewList = useMemo(() => {
    if (selectedSubject == null) return []
    return records.filter(r => {
      if (r.subject_id !== selectedSubject) return false
      if (selectedChapter != null && r.chapter_id !== selectedChapter) return false
      return true
    })
  }, [records, selectedSubject, selectedChapter])

  function handleWrongCountUpdate(questionId: string, newCount: number) {
    setRecords(prev => prev.map(r =>
      r.question_id === questionId
        ? { ...r, wrong_count: newCount, last_wrong_at: new Date().toISOString() }
        : r
    ))
  }

  function startReview(chapterId: number | null) {
    setSelectedChapter(chapterId)
    setPhase('review')
  }

  function backToSelect() {
    setPhase('select')
  }

  if (loading) {
    return <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">加载中...</div>
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
        <div className="text-4xl mb-3">🎉</div>
        <div>暂无错题记录，继续加油！</div>
      </div>
    )
  }

  // ── 回顾界面 ──────────────────────────────────────────────────────
  if (phase === 'review') {
    const subjectTitle = subjects.find(s => s.id === selectedSubject)?.title
    const chapterTitle = selectedChapter != null
      ? chapters.find(c => c.id === selectedChapter)?.title
      : '全部章节'

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={backToSelect}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 transition-colors"
          >
            ← 返回选择
          </button>
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{subjectTitle}</span>
            <span className="mx-1 text-gray-300">/</span>
            <span>{chapterTitle}</span>
            <span className="ml-2 text-xs text-gray-400">（共 {reviewList.length} 道错题）</span>
          </div>
        </div>

        {reviewList.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400 text-sm">
            该范围内暂无错题
          </div>
        ) : (
          reviewList.map((r, i) => (
            <WrongQuestionCard
              key={r.question_id}
              record={r}
              index={i}
              total={reviewList.length}
              onWrongCountUpdate={handleWrongCountUpdate}
            />
          ))
        )}
      </div>
    )
  }

  // ── 选择界面 ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-1">错题回顾</h2>
        <p className="text-xs text-gray-500 mb-4">
          共 <span className="font-medium text-gray-700">{records.length}</span> 道错题，选择科目和章节开始回顾练习
        </p>

        {/* 科目选择 */}
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-2 font-medium">选择科目</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSubject(s.id === selectedSubject ? null : s.id)
                  setSelectedChapter(null)
                }}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors text-left ${
                  selectedSubject === s.id
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                }`}
              >
                <div>{s.title}</div>
                <div className={`text-xs mt-0.5 ${selectedSubject === s.id ? 'text-blue-100' : 'text-gray-400'}`}>
                  {s.count} 道错题
                </div>
              </button>
            ))}
            {subjects.find(s => s.id === null) || records.some(r => r.subject_id == null) ? (
              <button
                onClick={() => { setSelectedSubject(-1); setSelectedChapter(null) }}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors text-left ${
                  selectedSubject === -1
                    ? 'bg-gray-500 text-white border-gray-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                <div>未分类</div>
                <div className={`text-xs mt-0.5 ${selectedSubject === -1 ? 'text-gray-100' : 'text-gray-400'}`}>
                  {records.filter(r => r.subject_id == null).length} 道错题
                </div>
              </button>
            ) : null}
          </div>
        </div>

        {/* 章节选择 */}
        {selectedSubject != null && selectedSubject !== -1 && (
          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs text-gray-500 mb-2 font-medium">选择章节</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => startReview(null)}
                className="px-4 py-2 rounded-lg border border-indigo-500 bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
              >
                全部章节 ({reviewList.length || records.filter(r => r.subject_id === selectedSubject).length})
              </button>
              {chapters.map(c => (
                <button
                  key={c.id}
                  onClick={() => startReview(c.id)}
                  className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-indigo-400 transition-colors"
                >
                  {c.title} ({c.count})
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">点击章节进入回顾练习模式</div>
          </div>
        )}

        {selectedSubject === -1 && (
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => startReview(null)}
              className="px-4 py-2 rounded-lg border border-indigo-500 bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
            >
              开始回顾未分类错题 ({records.filter(r => r.subject_id == null).length})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
