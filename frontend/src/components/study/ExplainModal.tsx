'use client'
import { useState, useEffect, useRef } from 'react'
import { explainKnowledge } from '@/lib/api'
import ReactMarkdown from 'react-markdown'

/** 将 AI 连续输出的文本（可能无换行）强制拆分为结构化 Markdown */
function fixMarkdown(raw: string): string {
  let s = raw.replace(/\r\n/g, '\n')

  // ── 第一步：在关键位置强制插入换行（处理无换行的连续文本）──

  // "。数字." → "。\n\n数字."  （句号后紧跟序号）
  s = s.replace(/。(\d+[.、．])\s*/g, '。\n\n$1 ')

  // "。- " → "。\n\n- "
  s = s.replace(/。(\s*- )/g, '。\n\n- ')

  // " - " 中间的列表项（前面是普通文字时）
  s = s.replace(/([。；;！!」\]】）\)])\s+- /g, '$1\n\n- ')

  // "**xxx**：文字。 - " → 在 " - " 前换行
  s = s.replace(/([^-\n])\s{1,3}- (?=[^\s])/g, '$1\n- ')

  // "**加粗标题**：" 前插入空行（段落标题）
  s = s.replace(/([^\n])(\*\*[^*\n]{1,20}\*\*[：:]\s*)/g, '$1\n\n$2')

  // "## 标题" 前插入空行
  s = s.replace(/([^\n])(#{1,3} )/g, '$1\n\n$2')

  // ── 第二步：已有换行的情况下补齐空行 ──
  s = s.replace(/\n(\d+[.、．]\s)/g, '\n\n$1')
  s = s.replace(/\n(\s*- )/g, '\n\n$1')
  s = s.replace(/\n(#{1,3} )/g, '\n\n$1')

  // ── 第三步：清理多余空行 ──
  s = s.replace(/\n{3,}/g, '\n\n')

  return s.trim()
}

export default function ExplainModal({
  kp,
  onClose,
}: {
  kp: { title: string; content: string }
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText('')
    setError('')
    setLoading(true)
    explainKnowledge(
      kp.title,
      kp.content,
      (chunk) => {
        setText(prev => prev + chunk)
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        }, 0)
      },
      () => setLoading(false),
      (err) => { setError(err); setLoading(false) },
    )
  }, [kp.title, kp.content])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[85vh]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span className="font-bold text-gray-800 text-sm">AI 解释</span>
            {loading && (
              <span className="text-xs text-green-500 animate-pulse">生成中...</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
        </div>

        {/* 知识点标题 */}
        <div className="px-5 py-2.5 bg-green-50 text-sm font-medium text-green-800 border-b">
          {kp.title}
        </div>

        {/* 内容区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="text-red-500 text-sm">
              ⚠️ 解释失败：{error}
              <div className="mt-2 text-xs text-gray-400">请检查后台是否已配置 DeepSeek API Key</div>
            </div>
          ) : (
            <div className="prose prose-sm prose-gray max-w-none
              prose-headings:font-bold prose-headings:text-gray-800
              prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5
              prose-strong:text-gray-800 prose-strong:font-semibold
              prose-ul:my-1.5 prose-ul:pl-5
              prose-ol:my-1.5 prose-ol:pl-5
              prose-li:text-gray-700 prose-li:my-0.5
              prose-blockquote:border-l-green-400 prose-blockquote:text-gray-600
              prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-xs
            ">
              <ReactMarkdown>{fixMarkdown(text) || (loading ? '' : '暂无内容')}</ReactMarkdown>
              {loading && (
                <span className="inline-block animate-pulse text-green-500 text-base ml-0.5">▋</span>
              )}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-5 py-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
