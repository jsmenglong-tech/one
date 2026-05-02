'use client'
import { useState, useEffect } from 'react'
import { getSubjects, getChapters, getKnowledge, generateQuestionBatch, recordWrong } from '@/lib/api'

// ── 单题做题卡片（逐题模式）────────────────────────────────
function QuestionCard({
  q,
  index,
  total,
  onNext,
  isLast,
}: {
  q: any
  index: number
  total: number
  onNext: () => void
  isLast: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [wrongRecorded, setWrongRecorded] = useState(false)

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
    setSubmitted(true)
    const isCorrect = isMultiple
      ? selected.sort().join('') === correctAnswers.sort().join('')
      : selected[0] === q.answer
    if (!isCorrect && !wrongRecorded && q.options) {
      setWrongRecorded(true)
      try { await recordWrong(q.id) } catch {}
    }
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
      {/* 进度条 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">第 {index + 1} / {total} 题</span>
        <div className="h-2 flex-1 mx-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
          {q.type === 'single' ? '单选题' : q.type === 'multiple' ? '多选题' : '案例题'}
        </span>
      </div>

      <p className="text-gray-800 font-medium mb-5 leading-relaxed">{q.question}</p>

      {/* 选项 */}
      {q.options && (
        <div className="space-y-2 mb-5">
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

      {/* 案例题提示 */}
      {!q.options && !submitted && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
          案例分析题，点击"查看答案"后显示参考答案和解析。
        </div>
      )}

      {/* 案例题答案 */}
      {!q.options && submitted && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
          <div className="font-medium text-gray-600 mb-1">参考答案：</div>
          {q.answer}
        </div>
      )}

      {/* 答题结果 */}
      {submitted && q.options && (
        <div className={`text-sm font-medium mb-3 ${isCorrectAnswer ? 'text-green-600' : 'text-red-500'}`}>
          {isCorrectAnswer ? '✓ 回答正确！' : `✗ 回答错误，正确答案：${q.answer}`}
        </div>
      )}

      {/* 解析 */}
      {submitted && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-gray-600 mb-4">
          <span className="font-medium text-blue-700">解析：</span>
          {q.analysis}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={q.options ? selected.length === 0 : false}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {q.options ? (isMultiple ? `提交答案（已选 ${selected.length} 项）` : '提交答案') : '查看答案'}
          </button>
        )}
        {submitted && !isLast && (
          <button
            onClick={onNext}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700"
          >
            下一题
          </button>
        )}
        {submitted && isLast && (
          <div className="text-gray-500 text-sm py-2 font-medium">🎉 已完成全部题目！</div>
        )}
      </div>
    </div>
  )
}

// ── 主组件 ───────────────────────────────────────────────────
export default function PracticeTab() {
  // 配置区 state
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [chapters, setChapters] = useState<any[]>([])
  const [chapterId, setChapterId] = useState<number | ''>('')
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [qType, setQType] = useState<'single' | 'multiple' | 'case'>('single')
  const [numQuestions, setNumQuestions] = useState<number>(10)
  const [customNum, setCustomNum] = useState<string>('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 做题区 state
  const [questions, setQuestions] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<'config' | 'practice'>('config')

  // 初始化加载科目
  useEffect(() => {
    getSubjects().then(d => setSubjects(d.subjects || []))
  }, [])

  // 科目变化时加载章节
  useEffect(() => {
    setChapterId('')
    setSelected([])
    setKnowledge([])
    if (subjectId !== '') {
      getChapters({ subject_id: Number(subjectId) }).then(d => setChapters(d.chapters || []))
    } else {
      setChapters([])
    }
  }, [subjectId])

  // 章节变化时加载知识点
  useEffect(() => {
    setSelected([])
    const params: any = { size: 200 }
    if (chapterId !== '') {
      params.chapter_id = Number(chapterId)
      getKnowledge(params).then(d => setKnowledge(d.items))
    } else if (subjectId !== '') {
      if (chapters.length > 0) {
        Promise.all(
          chapters.map((c: any) => getKnowledge({ chapter_id: c.id, size: 200 }))
        ).then(results => {
          setKnowledge(results.flatMap(r => r.items))
        })
      } else {
        setKnowledge([])
      }
    } else {
      setKnowledge([])
    }
  }, [chapterId, chapters])

  function toggleSelect(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function selectAll() { setSelected(knowledge.map(k => k.id)) }
  function clearAll() { setSelected([]) }

  async function handleGenerate() {
    if (!selected.length) return

    let targetNum: number
    if (qType === 'case') {
      targetNum = selected.length
    } else {
      targetNum = numQuestions
      if (selected.length > targetNum) {
        const input = window.prompt(
          `你选择了 ${selected.length} 个知识点，但题目数量只有 ${targetNum} 道。\n请输入要生成的题目数量（必须 ≥ ${selected.length}）：`,
          String(selected.length)
        )
        if (!input) return
        const parsed = parseInt(input, 10)
        if (isNaN(parsed) || parsed < selected.length) {
          setError(`题目数量必须 ≥ 知识点数量（${selected.length}）`)
          return
        }
        targetNum = parsed
        setNumQuestions(parsed)
      }
    }

    setLoading(true)
    setError(null)
    try {
      const r = await generateQuestionBatch({
        knowledge_ids: selected,
        type: qType,
        num_questions: qType === 'case' ? undefined : targetNum,
      })
      const items = r.items || []
      const succeeded = items.filter((i: any) => i.success !== false)
      const failed = items.filter((i: any) => i.success === false)

      if (succeeded.length === 0) {
        setError('题目生成失败，请重试')
        return
      }
      if (failed.length > 0) {
        setError(`${succeeded.length} 道题生成成功，${failed.length} 道失败`)
      }
      setQuestions(succeeded)
      setCurrentIndex(0)
      setPhase('practice')
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const TYPE_LABELS = { single: '单选题', multiple: '多选题', case: '案例题' }

  // ── 做题界面 ─────────────────────────────────────────────
  if (phase === 'practice') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setPhase('config'); setQuestions([]) }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-600 transition-colors"
          >
            ← 重新出题
          </button>
          <span className="text-sm text-gray-500">
            共 {questions.length} 道{TYPE_LABELS[qType]}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-600">
            ⚠ {error}
          </div>
        )}

        <QuestionCard
          key={currentIndex}
          q={questions[currentIndex]}
          index={currentIndex}
          total={questions.length}
          onNext={() => setCurrentIndex(i => i + 1)}
          isLast={currentIndex === questions.length - 1}
        />
      </div>
    )
  }

  // ── 配置界面 ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-800">练习出题</h2>

        {/* 题型选择 */}
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">选择题型</div>
          <div className="flex gap-3">
            {(['single', 'multiple', 'case'] as const).map(t => (
              <button key={t} onClick={() => setQType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  qType === t ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 科目 → 章节 筛选 */}
        <div className="mb-4 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 block mb-1">选择科目</label>
            <select
              className="border rounded-lg px-3 py-2 w-full text-sm"
              value={subjectId}
              onChange={e => setSubjectId(Number(e.target.value) || '')}
            >
              <option value="">请选择科目</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 block mb-1">选择章节（可选）</label>
            <select
              className="border rounded-lg px-3 py-2 w-full text-sm"
              value={chapterId}
              onChange={e => setChapterId(Number(e.target.value) || '')}
              disabled={subjectId === ''}
            >
              <option value="">全部章节</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>

        {/* 知识点列表 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">
              选择知识点
              {selected.length > 0 && (
                qType === 'case'
                  ? <span className="ml-2 text-green-600 font-medium">已选 {selected.length} 个 → 将生成 {selected.length} 道案例题</span>
                  : <span className="ml-2 text-green-600 font-medium">已选 {selected.length} 个（素材池）</span>
              )}
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-green-500 hover:underline">全选</button>
              <span className="text-gray-300">|</span>
              <button onClick={clearAll} className="text-gray-400 hover:underline">清空</button>
            </div>
          </div>
          <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
            {knowledge.map(kp => (
              <label key={kp.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(kp.id)}
                  onChange={() => toggleSelect(kp.id)}
                  className="mt-0.5 accent-green-600"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800">{kp.title}</div>
                  <div className="text-xs text-gray-400 truncate">{kp.content}</div>
                </div>
              </label>
            ))}
            {knowledge.length === 0 && (
              <div className="p-4 text-center text-gray-400 text-sm">
                {subjectId === '' ? '请先选择科目' : '该科目/章节下暂无知识点'}
              </div>
            )}
          </div>
        </div>

        {/* 题目数量选择器（单选/多选时显示） */}
        {qType !== 'case' && (
          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">
              生成题目数量
              {selected.length > 0 && selected.length > numQuestions && (
                <span className="ml-2 text-orange-500 text-xs">⚠ 知识点数({selected.length})超过题目数，生成时将提示输入</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {[5, 10, 15, 30].map(n => (
                <button key={n} onClick={() => { setNumQuestions(n); setShowCustomInput(false) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    numQuestions === n && !showCustomInput
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {n} 道
                </button>
              ))}
              <button onClick={() => setShowCustomInput(v => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showCustomInput ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                自定义
              </button>
              {showCustomInput && (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} value={customNum}
                    onChange={e => setCustomNum(e.target.value)}
                    placeholder="输入数量"
                    className="border rounded-lg px-3 py-2 w-24 text-sm"
                  />
                  <button
                    onClick={() => {
                      const n = parseInt(customNum, 10)
                      if (!isNaN(n) && n > 0) { setNumQuestions(n); setShowCustomInput(false) }
                    }}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200">
                    确认
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={loading || selected.length === 0}
          className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'AI 出题中，请稍候...'
            : qType === 'case'
              ? `生成 ${selected.length || 0} 道案例题并开始练习`
              : `生成 ${numQuestions} 道${TYPE_LABELS[qType]}并开始练习`}
        </button>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  )
}
