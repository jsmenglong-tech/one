'use client'
import { useState, useEffect } from 'react'
import { getSubjects, getChapters, getKnowledge, generateQuestionBatch, getQuestions, recordWrong } from '@/lib/api'

// 单题交互组件
function QuestionCard({ q, index }: { q: any; index: number }) {
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
    if (!selected.length) return
    setSubmitted(true)
    const isCorrect = isMultiple
      ? selected.sort().join('') === correctAnswers.sort().join('')
      : selected[0] === q.answer
    if (!isCorrect && !wrongRecorded) {
      setWrongRecorded(true)
      try { await recordWrong(q.id) } catch {}
    }
  }

  function getOptionStyle(key: string) {
    if (!submitted) {
      return selected.includes(key)
        ? 'border-blue-500 bg-blue-50 text-blue-800'
        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
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
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-gray-400">第 {index + 1} 题</span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
          {q.type === 'single' ? '单选题' : q.type === 'multiple' ? '多选题' : '案例题'}
        </span>
        {q.quality_checked && (
          <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">质检✓</span>
        )}
        {submitted && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${isCorrectAnswer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isCorrectAnswer ? '✓ 回答正确' : '✗ 回答错误'}
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-gray-800 mb-4 leading-relaxed">{q.question}</div>
      {q.options && (
        <div className="space-y-2 mb-4">
          {Object.entries(q.options as Record<string, string>).map(([key, val]) => (
            <button key={key} onClick={() => toggleOption(key)}
              className={`w-full text-left text-sm px-4 py-2.5 rounded-lg border transition-all ${getOptionStyle(key)}`}>
              <span className="font-medium mr-2">{key}.</span>{val}
            </button>
          ))}
        </div>
      )}
      {!q.options && submitted && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
          <div className="font-medium text-gray-600 mb-1">参考答案：</div>
          {q.answer}
        </div>
      )}
      {!q.options && !submitted && (
        <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700">
          案例分析题，点击"查看答案"后显示参考答案和解析。
        </div>
      )}
      {!submitted ? (
        <button onClick={handleSubmit}
          disabled={!q.options ? false : selected.length === 0}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
          {q.options ? (isMultiple ? `提交答案（已选 ${selected.length} 项）` : '提交答案') : '查看答案'}
        </button>
      ) : (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-gray-600">
          <span className="font-medium text-blue-700">解析：</span>
          {q.analysis}
        </div>
      )}
    </div>
  )
}

// 主组件
export default function QuestionTab() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [chapters, setChapters] = useState<any[]>([])
  const [chapterId, setChapterId] = useState<number | ''>('')
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [qType, setQType] = useState<'single' | 'multiple' | 'case'>('single')
  const [numQuestions, setNumQuestions] = useState<number>(5)
  const [customNum, setCustomNum] = useState<string>('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatedList, setGeneratedList] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')

  useEffect(() => {
    getSubjects().then(d => setSubjects(d.subjects || []))
    loadQuestions()
    // 初始加载全部知识点
    getKnowledge({ size: 100 }).then(d => setKnowledge(d.items))
  }, [])

  // 科目变化时加载章节
  useEffect(() => {
    setChapterId('')
    setSelected([])
    if (subjectId !== '') {
      getChapters({ subject_id: Number(subjectId) }).then(d => setChapters(d.chapters || []))
    } else {
      setChapters([])
    }
  }, [subjectId])

  // 章节变化时加载知识点
  useEffect(() => {
    setSelected([])
    const params: any = { size: 100 }
    if (chapterId !== '') {
      params.chapter_id = Number(chapterId)
    } else if (subjectId !== '') {
      // 科目下所有章节的知识点：依次加载每章，或直接用章节列表过滤
      // 简单方案：chapter_id 不传，但只显示该科目相关的知识点
      // 通过并发拉取该科目下所有章节知识点
      if (chapters.length > 0) {
        Promise.all(
          chapters.map(c => getKnowledge({ chapter_id: c.id, size: 200 }))
        ).then(results => {
          const all = results.flatMap(r => r.items)
          setKnowledge(all)
        })
        return
      }
    }
    getKnowledge(params).then(d => setKnowledge(d.items))
  }, [chapterId, chapters])

  async function loadQuestions() {
    setListLoading(true)
    getQuestions({ size: 50 }).then(d => setQuestions(d.items)).finally(() => setListLoading(false))
  }

  function toggleSelect(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function selectAll() { setSelected(knowledge.map(k => k.id)) }
  function clearAll() { setSelected([]) }

  async function handleGenerate() {
    if (!selected.length) return

    // 确定实际要生成的题目数量
    let targetNum: number
    if (qType === 'case') {
      targetNum = selected.length
    } else {
      targetNum = numQuestions
      // 如果知识点数 > 目标题目数，提示用户
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
    setGeneratedList([])
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
      setGeneratedList(succeeded)
      if (failed.length > 0) {
        setError(`${succeeded.length} 道题生成成功，${failed.length} 道失败`)
      }
      await loadQuestions()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const TYPE_LABELS = { single: '单选题', multiple: '多选题', case: '案例题' }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-800">生成题目</h2>

        {/* 题型选择 */}
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">选择题型</div>
          <div className="flex gap-3">
            {(['single', 'multiple', 'case'] as const).map(t => (
              <button key={t} onClick={() => setQType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${qType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 科目 → 章节 筛选 */}
        <div className="mb-4 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 block mb-1">按科目筛选</label>
            <select className="border rounded-lg px-3 py-2 w-full text-sm"
              value={subjectId} onChange={e => setSubjectId(Number(e.target.value) || '')}>
              <option value="">全部科目</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 block mb-1">按章节筛选</label>
            <select className="border rounded-lg px-3 py-2 w-full text-sm"
              value={chapterId} onChange={e => setChapterId(Number(e.target.value) || '')}
              disabled={subjectId === ''}>
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
                  ? <span className="ml-2 text-blue-600 font-medium">已选 {selected.length} 个 → 将生成 {selected.length} 道案例题</span>
                  : <span className="ml-2 text-blue-600 font-medium">已选 {selected.length} 个（素材池）</span>
              )}
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-blue-500 hover:underline">全选</button>
              <span className="text-gray-300">|</span>
              <button onClick={clearAll} className="text-gray-400 hover:underline">清空</button>
            </div>
          </div>
          <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
            {knowledge.map(kp => (
              <label key={kp.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(kp.id)} onChange={() => toggleSelect(kp.id)}
                  className="mt-0.5 accent-blue-600" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800">{kp.title}</div>
                  <div className="text-xs text-gray-400 truncate">{kp.content}</div>
                </div>
              </label>
            ))}
            {knowledge.length === 0 && (
              <div className="p-4 text-center text-gray-400 text-sm">
                {subjectId !== '' ? '该科目/章节下暂无知识点' : '请先导入知识点'}
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {n} 道
                </button>
              ))}
              <button onClick={() => setShowCustomInput(v => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showCustomInput ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">
                    确认
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={handleGenerate} disabled={loading || selected.length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading
            ? `AI生成中，请稍候...`
            : qType === 'case'
              ? `生成 ${selected.length || ''} 道${TYPE_LABELS[qType]}`
              : `生成 ${numQuestions} 道${TYPE_LABELS[qType]}`}
        </button>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">⚠ {error}</div>
        )}
      </div>

      {generatedList.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-800">本次生成 {generatedList.length} 道题</h3>
            <span className="text-xs text-gray-400">请作答后查看解析</span>
          </div>
          {generatedList.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i} />
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow">
        <div className="px-4 py-3 border-b font-medium text-gray-700 flex items-center justify-between">
          <span>历史题目库</span>
          <div className="flex items-center gap-3">
            {questions.length > 0 && <span className="text-xs text-gray-400">共 {questions.length} 题</span>}
            <button onClick={loadQuestions} className="text-xs text-blue-500 hover:underline">刷新</button>
          </div>
        </div>
        {listLoading && <div className="p-6 text-center text-gray-400">加载中...</div>}
        <div className="divide-y">
          {questions.map((q, i) => (
            <div key={q.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400">{questions.length - i}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  {TYPE_LABELS[q.type as keyof typeof TYPE_LABELS]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${q.quality_checked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {q.quality_checked ? '质检✓' : '待质检'}
                </span>
              </div>
              <div className="text-sm text-gray-800 line-clamp-2">{q.question}</div>
            </div>
          ))}
          {questions.length === 0 && !listLoading && (
            <div className="p-6 text-center text-gray-400 text-sm">暂无题目</div>
          )}
        </div>
      </div>
    </div>
  )
}
