'use client'
import { useState, useEffect } from 'react'
import {
  getSubjects, createSubject, updateSubject, deleteSubject,
  getChapters, createChapter, updateChapter, deleteChapter,
  getKnowledge, searchKnowledge, deleteKnowledge, updateKnowledge
} from '@/lib/api'

const DIFFICULTY_LABEL: Record<number, string> = {
  1: '很易', 2: '易', 3: '中', 4: '难', 5: '很难'
}

// ── 修改知识点弹窗 ─────────────────────────────────────────────────────────────
function EditModal({ kp, chapters, onClose, onSaved }: {
  kp: any, chapters: any[], onClose: () => void, onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: kp.title || '',
    content: kp.content || '',
    chapter_id: kp.chapter_id || '',
    tags: (kp.tags || []).join('，'),
    difficulty: kp.difficulty || 3,
    source: kp.source || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await updateKnowledge(kp.id, {
        ...form,
        chapter_id: form.chapter_id ? Number(form.chapter_id) : null,
        tags: form.tags ? form.tags.split(/[，,]+/).map((t: string) => t.trim()).filter(Boolean) : [],
        difficulty: Number(form.difficulty),
      })
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <span className="font-bold text-gray-800">修改知识点</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">标题</label>
            <input className="border rounded-lg px-3 py-2 w-full text-sm"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">内容</label>
            <textarea className="border rounded-lg px-3 py-2 w-full text-sm h-28 resize-none"
              value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">章节</label>
              <select className="border rounded-lg px-3 py-2 w-full text-sm"
                value={form.chapter_id} onChange={e => setForm(f => ({ ...f, chapter_id: e.target.value }))}>
                <option value="">无</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="w-28">
              <label className="text-xs text-gray-500 block mb-1">难度</label>
              <select className="border rounded-lg px-3 py-2 w-full text-sm"
                value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: Number(e.target.value) }))}>
                {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">标签（逗号分隔）</label>
            <input className="border rounded-lg px-3 py-2 w-full text-sm"
              value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">来源</label>
            <input className="border rounded-lg px-3 py-2 w-full text-sm"
              value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 知识点列表面板 ─────────────────────────────────────────────────────────────
function KnowledgeListPanel() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [chapters, setChapters] = useState<any[]>([])   // 当前科目下的章节（平铺）
  const [allChapters, setAllChapters] = useState<any[]>([]) // 用于编辑弹窗
  const [chapterId, setChapterId] = useState<number | ''>('')
  const [itemType, setItemType] = useState<'' | 'knowledge' | 'example'>('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [editKp, setEditKp] = useState<any>(null)
  const [deleteKp, setDeleteKp] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  function flattenChapters(tree: any[], prefix = ''): any[] {
    return tree.flatMap((c: any) => [
      { id: c.id, title: prefix + c.title },
      ...flattenChapters(c.children || [], prefix + '  ')
    ])
  }

  useEffect(() => {
    getSubjects().then(d => setSubjects(d.subjects || []))
    getChapters().then(d => setAllChapters(flattenChapters(d.chapters)))
  }, [])

  // 科目变化时加载该科目的章节
  useEffect(() => {
    setChapterId('')
    setPage(1)
    if (subjectId !== '') {
      getChapters({ subject_id: Number(subjectId) }).then(d =>
        setChapters(d.chapters || [])
      )
    } else {
      setChapters([])
    }
  }, [subjectId])

  useEffect(() => {
    setLoading(true)
    getKnowledge({
      chapter_id: chapterId || undefined,
      item_type: itemType || undefined,
      page,
      size: 15
    }).then(setData).finally(() => setLoading(false))
  }, [chapterId, itemType, page])

  async function handleSearch() {
    if (!searchQ) return
    setLoading(true)
    try {
      const r = await searchKnowledge(searchQ, 10)
      setSearchResult(r)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteKp) return
    setDeleting(true)
    try {
      await deleteKnowledge(deleteKp.id)
      setDeleteKp(null)
      setLoading(true)
      getKnowledge({
        chapter_id: chapterId || undefined,
        item_type: itemType || undefined,
        page, size: 15
      }).then(setData).finally(() => setLoading(false))
    } finally {
      setDeleting(false)
    }
  }

  const displayItems = searchResult ? searchResult.results : data?.items || []

  return (
    <div className="space-y-4">
      {editKp && (
        <EditModal kp={editKp} chapters={allChapters} onClose={() => setEditKp(null)} onSaved={() => {
          setLoading(true)
          getKnowledge({ chapter_id: chapterId || undefined, item_type: itemType || undefined, page, size: 15 })
            .then(setData).finally(() => setLoading(false))
        }} />
      )}
      {deleteKp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-base font-bold text-gray-800 mb-2">确认删除该知识点？</div>
            <div className="text-sm text-gray-500 mb-4">「{deleteKp.title}」删除后不可恢复。</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteKp(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl shadow p-4 flex gap-3 flex-wrap items-end">
        {/* 按科目 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">按科目筛选</label>
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={subjectId}
            onChange={e => { setSubjectId(Number(e.target.value) || ''); setSearchResult(null); setPage(1) }}
          >
            <option value="">全部科目</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        {/* 按章节 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">按章节筛选</label>
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={chapterId}
            onChange={e => { setChapterId(Number(e.target.value) || ''); setSearchResult(null); setPage(1) }}
            disabled={subjectId === ''}
          >
            <option value="">{subjectId === '' ? '全部章节' : '全部章节'}</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        {/* 类型 */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">类型</label>
          <div className="flex gap-1">
            {(['', 'knowledge', 'example'] as const).map(t => (
              <button key={t}
                onClick={() => { setItemType(t); setSearchResult(null); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  itemType === t
                    ? t === 'example' ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {t === '' ? '全部' : t === 'knowledge' ? '知识点' : '例题'}
              </button>
            ))}
          </div>
        </div>
        {/* 搜索 */}
        <div className="flex-1 min-w-48">
          <label className="text-xs text-gray-500 block mb-1">关键词搜索</label>
          <div className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1"
              placeholder="输入关键词搜索标题/内容..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">搜索</button>
            {searchResult && (
              <button onClick={() => { setSearchResult(null); setSearchQ('') }}
                className="border px-3 py-2 rounded-lg text-sm text-gray-500">清除</button>
            )}
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-medium text-gray-700">
            {searchResult ? `搜索结果（${searchResult.results.length}条）` : `知识点列表（共 ${data?.total ?? '...'} 条）`}
          </span>
        </div>
        {loading && <div className="p-8 text-center text-gray-400">加载中...</div>}
        <div className="divide-y">
          {displayItems.map((kp: any) => (
            <div key={kp.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-gray-800 text-sm flex-1">{kp.title}</div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {kp.item_type === 'example' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">例题</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">知识点</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    kp.difficulty >= 4 ? 'bg-red-100 text-red-600' :
                    kp.difficulty <= 2 ? 'bg-green-100 text-green-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>{DIFFICULTY_LABEL[kp.difficulty] || '中'}</span>
                  <button onClick={() => setEditKp(kp)}
                    className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50">修改</button>
                  <button onClick={() => setDeleteKp(kp)}
                    className="text-xs px-2 py-1 rounded border border-red-300 text-red-500 hover:bg-red-50">删除</button>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{kp.content}</p>
              <div className="mt-2 flex gap-1 flex-wrap">
                {kp.tags?.map((t: string) => (
                  <span key={t} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">{t}</span>
                ))}
                <span className="text-xs text-gray-400 ml-auto">{kp.id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
          {displayItems.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-400">暂无知识点</div>
          )}
        </div>
        {!searchResult && data && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>第 {page} 页，共 {Math.ceil(data.total / 15)} 页</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-40">上一页</button>
              <button disabled={page * 15 >= data.total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 科目管理面板 ───────────────────────────────────────────────────────────────
function SubjectManagePanel() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [forceDelete, setForceDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function load() {
    setLoading(true)
    getSubjects().then(d => setSubjects(d.subjects || [])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newTitle.trim()) return
    setError('')
    try {
      await createSubject({ title: newTitle.trim() })
      setNewTitle('')
      setSuccess('科目创建成功')
      setTimeout(() => setSuccess(''), 2000)
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || '创建失败')
    }
  }

  async function handleEdit() {
    if (!editTarget || !editTitle.trim()) return
    try {
      await updateSubject(editTarget.id, { title: editTitle.trim() })
      setEditTarget(null)
      setEditTitle('')
      setSuccess('科目已更新')
      setTimeout(() => setSuccess(''), 2000)
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || '修改失败')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await deleteSubject(deleteTarget.id, forceDelete)
      setDeleteTarget(null)
      setForceDelete(false)
      setSuccess('科目已删除')
      setTimeout(() => setSuccess(''), 2000)
      load()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || '删除失败'
      if (e?.response?.status === 409) {
        setForceDelete(true)
        setError(detail)
      } else {
        setDeleteTarget(null)
        setError(detail)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 编辑弹窗 */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-base font-bold text-gray-800 mb-4">修改科目名称</div>
            <input className="border rounded-lg px-3 py-2 w-full text-sm mb-4"
              value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEdit()} />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEditTarget(null); setEditTitle('') }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-base font-bold text-gray-800 mb-2">确认删除科目？</div>
            <div className="text-sm text-gray-600 mb-3">「{deleteTarget.title}」</div>
            {forceDelete && (
              <div className="text-sm text-red-600 mb-3">⚠️ 该科目下还有章节，强制删除后章节和知识点关联将解绑。</div>
            )}
            {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setForceDelete(false); setError('') }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
                {deleting ? '删除中...' : forceDelete ? '强制删除' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建科目 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-bold text-gray-700 mb-3">新建科目</h3>
        <div className="flex gap-2">
          <input className="border rounded-lg px-3 py-2 flex-1 text-sm"
            placeholder="如：一建实务、一建法规..."
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">创建</button>
        </div>
        {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
        {error && !deleteTarget && <div className="text-red-500 text-sm mt-2">{error}</div>}
      </div>

      {/* 科目列表 */}
      <div className="bg-white rounded-xl shadow">
        <div className="px-4 py-3 border-b">
          <span className="font-medium text-gray-700">科目列表（共 {subjects.length} 个）</span>
        </div>
        {loading && <div className="p-8 text-center text-gray-400">加载中...</div>}
        <div className="divide-y">
          {subjects.map(s => (
            <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
              <span className="text-sm text-gray-800 font-medium">{s.title}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditTarget(s); setEditTitle(s.title) }}
                  className="text-xs px-3 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50">
                  修改
                </button>
                <button
                  onClick={() => { setDeleteTarget(s); setForceDelete(false); setError('') }}
                  className="text-xs px-3 py-1 rounded border border-red-300 text-red-500 hover:bg-red-50">
                  删除
                </button>
              </div>
            </div>
          ))}
          {subjects.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-400">暂无科目</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 章节管理面板 ───────────────────────────────────────────────────────────────
function ChapterManagePanel() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [forceDelete, setForceDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    getSubjects().then(d => setSubjects(d.subjects || []))
  }, [])

  useEffect(() => {
    if (subjectId !== '') {
      loadChapters()
    } else {
      setChapters([])
    }
  }, [subjectId])

  function loadChapters() {
    if (subjectId === '') return
    setLoading(true)
    getChapters({ subject_id: Number(subjectId) })
      .then(d => setChapters(d.chapters || []))
      .finally(() => setLoading(false))
  }

  async function handleAdd() {
    if (!newTitle.trim() || subjectId === '') return
    setError('')
    try {
      await createChapter({ title: newTitle.trim(), parent_id: Number(subjectId) })
      setNewTitle('')
      setSuccess('章节创建成功')
      setTimeout(() => setSuccess(''), 2000)
      loadChapters()
    } catch (e: any) {
      setError(e?.response?.data?.detail || '创建失败')
    }
  }

  async function handleEdit() {
    if (!editTarget || !editTitle.trim()) return
    try {
      await updateChapter(editTarget.id, { title: editTitle.trim() })
      setEditTarget(null)
      setEditTitle('')
      setSuccess('章节已更新')
      setTimeout(() => setSuccess(''), 2000)
      loadChapters()
    } catch (e: any) {
      setError(e?.response?.data?.detail || '修改失败')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await deleteChapter(deleteTarget.id, forceDelete)
      setDeleteTarget(null)
      setForceDelete(false)
      setSuccess('章节已删除')
      setTimeout(() => setSuccess(''), 2000)
      loadChapters()
    } catch (e: any) {
      const detail = e?.response?.data?.detail || '删除失败'
      if (e?.response?.status === 409) {
        setForceDelete(true)
        setError(detail)
      } else {
        setDeleteTarget(null)
        setError(detail)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 编辑弹窗 */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-base font-bold text-gray-800 mb-4">修改章节名称</div>
            <input className="border rounded-lg px-3 py-2 w-full text-sm mb-4"
              value={editTitle} onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEdit()} />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEditTarget(null); setEditTitle('') }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-base font-bold text-gray-800 mb-2">确认删除章节？</div>
            <div className="text-sm text-gray-600 mb-1">「{deleteTarget.title}」</div>
            {deleteTarget.knowledge_count > 0 && (
              <div className={`text-sm mb-3 ${forceDelete ? 'text-red-600' : 'text-orange-500'}`}>
                {forceDelete
                  ? `⚠️ 强制删除后，${deleteTarget.knowledge_count} 个知识点将变为"无章节"状态。`
                  : `该章节下有 ${deleteTarget.knowledge_count} 个知识点。`}
              </div>
            )}
            {!forceDelete && deleteTarget.knowledge_count === 0 && (
              <div className="text-sm text-gray-500 mb-3">删除后不可恢复。</div>
            )}
            {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setForceDelete(false); setError('') }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
                {deleting ? '删除中...' : forceDelete ? '强制删除' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 选科目 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-bold text-gray-700 mb-3">选择科目</h3>
        <select
          className="border rounded-lg px-3 py-2 w-full text-sm"
          value={subjectId}
          onChange={e => setSubjectId(Number(e.target.value) || '')}
        >
          <option value="">-- 请选择科目 --</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>

      {subjectId !== '' && (
        <>
          {/* 新建章节 */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-bold text-gray-700 mb-3">新建章节</h3>
            <div className="flex gap-2">
              <input className="border rounded-lg px-3 py-2 flex-1 text-sm"
                placeholder="输入章节名称..."
                value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()} />
              <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">创建</button>
            </div>
            {success && <div className="text-green-600 text-sm mt-2">{success}</div>}
            {error && !deleteTarget && <div className="text-red-500 text-sm mt-2">{error}</div>}
          </div>

          {/* 章节列表 */}
          <div className="bg-white rounded-xl shadow">
            <div className="px-4 py-3 border-b">
              <span className="font-medium text-gray-700">章节列表（共 {chapters.length} 个）</span>
            </div>
            {loading && <div className="p-8 text-center text-gray-400">加载中...</div>}
            <div className="divide-y">
              {chapters.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <span className="text-sm text-gray-800">{c.title}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {c.knowledge_count > 0 ? `${c.knowledge_count} 个知识点` : '暂无知识点'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditTarget(c); setEditTitle(c.title) }}
                      className="text-xs px-3 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50">修改</button>
                    <button onClick={() => { setDeleteTarget(c); setForceDelete(false); setError('') }}
                      className="text-xs px-3 py-1 rounded border border-red-300 text-red-500 hover:bg-red-50">删除</button>
                  </div>
                </div>
              ))}
              {chapters.length === 0 && !loading && (
                <div className="p-8 text-center text-gray-400">该科目下暂无章节</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 主组件（三标签页） ─────────────────────────────────────────────────────────
export default function KnowledgeTab() {
  const [tab, setTab] = useState<'list' | 'subjects' | 'chapters'>('list')

  const tabs = [
    { key: 'list', label: '知识点列表' },
    { key: 'subjects', label: '科目管理' },
    { key: 'chapters', label: '章节管理' },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'list' && <KnowledgeListPanel />}
      {tab === 'subjects' && <SubjectManagePanel />}
      {tab === 'chapters' && <ChapterManagePanel />}
    </div>
  )
}
