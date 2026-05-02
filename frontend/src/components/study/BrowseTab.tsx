'use client'
import { useState, useEffect } from 'react'
import { getSubjects, getChapters, getKnowledge } from '@/lib/api'
import ExplainModal from './ExplainModal'

const DIFFICULTY_LABEL: Record<number, string> = { 1: '很易', 2: '易', 3: '中', 4: '难', 5: '很难' }
const DIFFICULTY_COLOR: Record<number, string> = {
  1: 'bg-green-100 text-green-600',
  2: 'bg-green-100 text-green-600',
  3: 'bg-yellow-100 text-yellow-600',
  4: 'bg-red-100 text-red-600',
  5: 'bg-red-100 text-red-600',
}

// ── 标签云 ──────────────────────────────────────────────────
function TagCloud({
  tags,
  selected,
  onToggle,
}: {
  tags: string[]
  selected: string | null
  onToggle: (tag: string) => void
}) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {tags.map(tag => (
        <button
          key={tag}
          onClick={() => onToggle(tag)}
          className={`text-xs px-3 py-1 rounded-full border transition-all ${
            selected === tag
              ? 'bg-green-600 text-white border-green-600 shadow-sm'
              : 'bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-600'
          }`}
        >
          {tag}
        </button>
      ))}
      {selected && (
        <button
          onClick={() => onToggle(selected)}
          className="text-xs px-3 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-red-400"
        >
          × 清除筛选
        </button>
      )}
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────
export default function BrowseTab() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapter, setSelectedChapter] = useState<any>(null)
  const [knowledge, setKnowledge] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [explainKp, setExplainKp] = useState<{ title: string; content: string } | null>(null)

  // 加载科目列表
  useEffect(() => {
    getSubjects().then(d => setSubjects(d.subjects || []))
  }, [])

  // 科目变化时加载章节
  useEffect(() => {
    setSelectedChapter(null)
    setKnowledge([])
    setActiveTag(null)
    setChapters([])
    if (subjectId !== null) {
      getChapters({ subject_id: subjectId }).then(d =>
        setChapters(flattenChapters(d.chapters || []))
      )
    }
  }, [subjectId])

  function flattenChapters(tree: any[], prefix = ''): any[] {
    return tree.flatMap((c: any) => [
      { id: c.id, title: prefix + c.title, isChild: prefix !== '' },
      ...flattenChapters(c.children || [], prefix + '　')
    ])
  }

  async function selectChapter(c: any) {
    setSelectedChapter(c)
    setActiveTag(null)
    setExpanded(null)
    const d = await getKnowledge({ chapter_id: c.id, size: 100 })
    setKnowledge(d.items)
  }

  // 收集当前章节所有不重复标签
  const allTags = Array.from(
    new Set(knowledge.flatMap((kp: any) => kp.tags ?? []))
  ).sort()

  // 按标签筛选
  const filteredKnowledge = activeTag
    ? knowledge.filter((kp: any) => kp.tags?.includes(activeTag))
    : knowledge

  function toggleTag(tag: string) {
    setActiveTag(prev => (prev === tag ? null : tag))
  }

  return (
    <>
      {explainKp && (
        <ExplainModal kp={explainKp} onClose={() => setExplainKp(null)} />
      )}

      {/* 科目选择栏 */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="text-xs font-bold text-gray-500 mb-3">选择科目</div>
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSubjectId(subjectId === s.id ? null : s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                subjectId === s.id
                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
              }`}
            >
              {s.title}
            </button>
          ))}
          {subjects.length === 0 && (
            <span className="text-sm text-gray-400">暂无科目，请先在管理端添加</span>
          )}
        </div>
      </div>

      {/* 章节 + 知识点区域 */}
      {subjectId === null ? (
        <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
          请先在上方选择科目
        </div>
      ) : (
        <div className="flex gap-6">
          {/* 左侧章节列表 */}
          <div className="w-48 flex-shrink-0">
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b">章节目录</div>
              <div className="divide-y">
                {chapters.length === 0 && (
                  <div className="px-3 py-4 text-xs text-gray-400 text-center">该科目暂无章节</div>
                )}
                {chapters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectChapter(c)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors ${
                      selectedChapter?.id === c.id ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-600'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 min-w-0">
            {!selectedChapter ? (
              <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
                点击左侧章节查看知识点
              </div>
            ) : (
              <div className="space-y-3">
                {/* 标题行 */}
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-700">
                    {selectedChapter.title}（{knowledge.length} 个知识点
                    {activeTag ? `，当前筛选 ${filteredKnowledge.length} 个` : ''}）
                  </div>
                </div>

                {/* 标签云筛选 */}
                <TagCloud tags={allTags} selected={activeTag} onToggle={toggleTag} />

                {/* 知识点列表 */}
                {filteredKnowledge.map(kp => (
                  <div key={kp.id} className="bg-white rounded-xl shadow">
                    <button
                      className="w-full text-left p-4 flex items-center justify-between"
                      onClick={() => setExpanded(expanded === kp.id ? null : kp.id)}
                    >
                      <div className="font-medium text-gray-800 text-sm">{kp.title}</div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[kp.difficulty]}`}>
                          {DIFFICULTY_LABEL[kp.difficulty]}
                        </span>
                        <span className="text-gray-400 text-xs">{expanded === kp.id ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {expanded === kp.id && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{kp.content}</p>

                        {/* 标签 + AI 解释按钮 */}
                        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex gap-1 flex-wrap">
                            {kp.tags?.map((t: string) => (
                              <button
                                key={t}
                                onClick={() => toggleTag(t)}
                                className={`text-xs px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                  activeTag === t
                                    ? 'bg-green-600 text-white'
                                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={(e) => {
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

                {filteredKnowledge.length === 0 && (
                  <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
                    {activeTag ? `没有标签为「${activeTag}」的知识点` : '该章节暂无知识点'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
