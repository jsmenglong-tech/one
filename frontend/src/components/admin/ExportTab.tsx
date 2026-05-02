'use client'
import { useState, useEffect, useRef } from 'react'
import { getSubjects, getChapters, exportKnowledgePack, importKnowledgePack } from '@/lib/api'

export default function ExportTab() {
  const [mode, setMode] = useState<'all' | 'subject' | 'chapter'>('all')
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [chapters, setChapters] = useState<any[]>([])
  const [chapterId, setChapterId] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 导入状态
  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    getSubjects().then(d => setSubjects(d.subjects || []))
  }, [])

  useEffect(() => {
    setChapterId('')
    if (subjectId !== '') {
      getChapters({ subject_id: Number(subjectId) }).then(d => setChapters(d.chapters || []))
    } else {
      setChapters([])
    }
  }, [subjectId])

  async function handleExport() {
    setLoading(true)
    setDone(false)
    setError(null)
    try {
      const params: { subject_id?: number; chapter_id?: number } = {}
      if (mode === 'subject' && subjectId !== '') params.subject_id = Number(subjectId)
      if (mode === 'chapter' && chapterId !== '') params.chapter_id = Number(chapterId)
      await exportKnowledgePack(params)
      setDone(true)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || '未知错误'
      setError(`导出失败：${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setImportError(null)
    try {
      const result = await importKnowledgePack(file)
      setImportResult(result.stats)
    } catch (e: any) {
      setImportError(e?.response?.data?.detail || e?.message || '导入失败')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  const canExport = () => {
    if (mode === 'all') return true
    if (mode === 'subject') return subjectId !== ''
    if (mode === 'chapter') return chapterId !== ''
    return false
  }

  return (
    <div className="space-y-6">
      {/* 导出区块 */}
      <div className="bg-white rounded-xl shadow p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-2">导出知识库</h2>
        <p className="text-gray-500 text-sm mb-6">
          将知识库打包为 <code className="bg-gray-100 px-1 rounded">knowledge-pack.zip</code>，
          包含章节结构、知识点、题库和向量索引。
        </p>

        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-3">导出范围</div>
          <div className="space-y-3">
            <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              mode === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" name="export_mode" value="all"
                checked={mode === 'all'} onChange={() => setMode('all')} className="accent-blue-600" />
              <div>
                <div className="text-sm font-medium text-gray-800">全部导出</div>
                <div className="text-xs text-gray-500 mt-0.5">导出所有科目、章节和知识点</div>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              mode === 'subject' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" name="export_mode" value="subject"
                checked={mode === 'subject'} onChange={() => setMode('subject')} className="accent-blue-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">按科目导出</div>
                <div className="text-xs text-gray-500 mt-0.5 mb-2">导出指定科目下所有章节的知识点</div>
                {mode === 'subject' && (
                  <select
                    className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
                    value={subjectId}
                    onChange={e => setSubjectId(Number(e.target.value) || '')}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="">-- 选择科目 --</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                )}
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              mode === 'chapter' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" name="export_mode" value="chapter"
                checked={mode === 'chapter'} onChange={() => setMode('chapter')} className="accent-blue-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">按章节导出</div>
                <div className="text-xs text-gray-500 mt-0.5 mb-2">导出指定章节的知识点和题目</div>
                {mode === 'chapter' && (
                  <div className="space-y-2">
                    <select
                      className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
                      value={subjectId}
                      onChange={e => setSubjectId(Number(e.target.value) || '')}
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">-- 先选择科目 --</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                    <select
                      className="border rounded-lg px-3 py-2 w-full text-sm bg-white"
                      value={chapterId}
                      onChange={e => setChapterId(Number(e.target.value) || '')}
                      onClick={e => e.stopPropagation()}
                      disabled={subjectId === ''}
                    >
                      <option value="">{subjectId === '' ? '-- 请先选择科目 --' : '-- 选择章节 --'}</option>
                      {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm font-mono text-gray-600">
          <div>knowledge-pack/</div>
          <div className="ml-4">├── meta.json　　　　　<span className="text-gray-400">// 版本信息</span></div>
          <div className="ml-4">├── chapters.json　　 <span className="text-gray-400">// 章节结构</span></div>
          <div className="ml-4">├── knowledge.json　　<span className="text-gray-400">// 知识点</span></div>
          <div className="ml-4">├── questions.json　　<span className="text-gray-400">// 题库</span></div>
          <div className="ml-4">├── embeddings.bin　　<span className="text-gray-400">// FAISS向量索引</span></div>
          <div className="ml-4">└── embeddings_id_map.json</div>
        </div>

        <button
          onClick={handleExport}
          disabled={loading || !canExport()}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl text-base font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '打包中...' : '导出 knowledge-pack.zip'}
        </button>

        {done && (
          <div className="mt-4 text-green-600 text-sm font-medium">导出成功，文件已开始下载</div>
        )}
        {error && (
          <div className="mt-4 text-red-600 text-sm font-medium">{error}</div>
        )}
      </div>

      {/* 导入区块 */}
      <div className="bg-white rounded-xl shadow p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-2">导入知识库</h2>
        <p className="text-gray-500 text-sm mb-6">
          上传 <code className="bg-gray-100 px-1 rounded">knowledge-pack.zip</code>，
          系统将按 ID 去重合并，已存在的内容不会重复写入。
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          <input
            ref={importRef}
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
            id="import-zip-input"
          />
          <label
            htmlFor="import-zip-input"
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-medium cursor-pointer transition-colors ${
              importing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {importing ? '导入中...' : '选择 zip 文件导入'}
          </label>
        </div>

        {importResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <div className="font-medium mb-1">导入成功</div>
            <div>新增章节：{importResult.new_chapters} 个</div>
            <div>新增知识点：{importResult.new_knowledge_points} 条</div>
            <div>新增题目：{importResult.new_questions} 道</div>
          </div>
        )}
        {importError && (
          <div className="mt-4 text-red-600 text-sm font-medium">{importError}</div>
        )}
      </div>
    </div>
  )
}

