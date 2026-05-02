'use client'
import { useState, useEffect } from 'react'
import {
  getSubjects, createSubject, updateSubject, deleteSubject,
  getChapters, createChapter, updateChapter, deleteChapter,
  importChapter, importImage, previewSplit, getOcrConfig,
  saveBaiduOcr, saveDeepSeekConfig, saveEmbeddingConfig, saveVisionConfig,
  addImageCard, rebuildIndex
} from '@/lib/api'

export default function ImportTab() {
  // 科目 & 章节
  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [chapters, setChapters] = useState<any[]>([])
  const [chapterId, setChapterId] = useState<number | ''>('')

  // 新建科目
  const [newSubject, setNewSubject] = useState('')

  // 新建章节
  const [newChapter, setNewChapter] = useState('')

  // 导入
  const [content, setContent] = useState('')
  const [source, setSource] = useState('')
  const [mode, setMode] = useState<'text' | 'image' | 'image_card'>('text')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [preview, setPreview] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // OCR
  const [ocrEngine, setOcrEngine] = useState<'vision' | 'baidu' | 'local'>('vision')
  const [ocrConfig, setOcrConfig] = useState<any>(null)
  const [showBaiduForm, setShowBaiduForm] = useState(false)
  const [baiduApiKey, setBaiduApiKey] = useState('')
  const [baiduSecretKey, setBaiduSecretKey] = useState('')
  const [baiduSaving, setBaiduSaving] = useState(false)
  const [baiduMsg, setBaiduMsg] = useState('')

  // 视觉模型配置
  const [showVisionForm, setShowVisionForm] = useState(false)
  const [visionApiKey, setVisionApiKey] = useState('')
  const [visionBaseUrl, setVisionBaseUrl] = useState('https://api.apimart.ai/v1')
  const [visionModel, setVisionModel] = useState('gpt-4o-mini')
  const [visionSaving, setVisionSaving] = useState(false)
  const [visionMsg, setVisionMsg] = useState('')

  // Embedding
  const [showEmbeddingForm, setShowEmbeddingForm] = useState(false)
  const [embeddingApiKey, setEmbeddingApiKey] = useState('')
  const [embeddingSaving, setEmbeddingSaving] = useState(false)
  const [embeddingMsg, setEmbeddingMsg] = useState('')
  const [rebuildingIndex, setRebuildingIndex] = useState(false)
  const [rebuildMsg, setRebuildMsg] = useState('')

  // DeepSeek AI 配置
  const [showDeepSeekForm, setShowDeepSeekForm] = useState(false)
  const [deepseekApiKey, setDeepseekApiKey] = useState('')
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState('https://api.deepseek.com/v1')
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat')
  const [deepseekSaving, setDeepseekSaving] = useState(false)
  const [deepseekMsg, setDeepseekMsg] = useState('')

  // 初始化
  useEffect(() => {
    loadSubjects()
    getOcrConfig().then(setOcrConfig).catch(() => {})
  }, [])

  // 科目变化时加载章节
  useEffect(() => {
    setChapterId('')
    if (subjectId !== '') {
      getChapters({ subject_id: Number(subjectId) }).then(d => setChapters(d.chapters || []))
    } else {
      setChapters([])
    }
  }, [subjectId])

  function loadSubjects() {
    getSubjects()
      .then(d => setSubjects(d.subjects || []))
      .catch(() => setError('无法连接后端服务，请确认 http://localhost:8000 已启动'))
  }

  async function handleAddSubject() {
    if (!newSubject.trim()) return
    try {
      await createSubject({ title: newSubject.trim() })
      setNewSubject('')
      loadSubjects()
    } catch (e: any) {
      setError(e?.response?.data?.detail || '创建科目失败')
    }
  }

  async function handleAddChapter() {
    if (!newChapter.trim() || subjectId === '') return
    try {
      await createChapter({ title: newChapter.trim(), parent_id: Number(subjectId) })
      setNewChapter('')
      const d = await getChapters({ subject_id: Number(subjectId) })
      setChapters(d.chapters || [])
    } catch (e: any) {
      setError(e?.response?.data?.detail || '创建章节失败')
    }
  }

  async function handlePreview() {
    if (!content || !chapterId) return
    setLoading(true)
    setError(null)
    try {
      const r = await previewSplit({ chapter_id: Number(chapterId), content })
      setPreview(r)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '预览失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      let r
      if (mode === 'text') {
        r = await importChapter({ chapter_id: Number(chapterId) || 1, content, source })
      } else if (mode === 'image' && file) {
        r = await importImage(Number(chapterId) || 1, file, source, ocrEngine)
      } else if (mode === 'image_card' && file) {
        r = await addImageCard(Number(chapterId) || 1, file, source)
      }
      setResult(r)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '导入失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveOcr() {
    if (!baiduApiKey || !baiduSecretKey) return
    setBaiduSaving(true)
    setBaiduMsg('')
    try {
      await saveBaiduOcr({ api_key: baiduApiKey, secret_key: baiduSecretKey })
      setBaiduMsg('配置保存成功！')
      setShowBaiduForm(false)
      setBaiduApiKey('')
      setBaiduSecretKey('')
      const cfg = await getOcrConfig()
      setOcrConfig(cfg)
    } catch (e: any) {
      setBaiduMsg(e?.response?.data?.detail || '保存失败')
    } finally {
      setBaiduSaving(false)
    }
  }

  async function handleSaveVision() {
    if (!visionApiKey) return
    setVisionSaving(true)
    setVisionMsg('')
    try {
      await saveVisionConfig({ api_key: visionApiKey, base_url: visionBaseUrl, model: visionModel })
      setVisionMsg('配置保存成功！')
      setShowVisionForm(false)
      setVisionApiKey('')
      const cfg = await getOcrConfig()
      setOcrConfig(cfg)
    } catch (e: any) {
      setVisionMsg(e?.response?.data?.detail || '保存失败')
    } finally {
      setVisionSaving(false)
    }
  }

  async function handleSaveEmbedding() {
    if (!embeddingApiKey) return
    setEmbeddingSaving(true)
    setEmbeddingMsg('')
    try {
      await saveEmbeddingConfig({ api_key: embeddingApiKey })
      setEmbeddingMsg('配置保存成功！请点击"重建索引"按钮。')
      setShowEmbeddingForm(false)
      setEmbeddingApiKey('')
      const cfg = await getOcrConfig()
      setOcrConfig(cfg)
    } catch (e: any) {
      setEmbeddingMsg(e?.response?.data?.detail || '保存失败')
    } finally {
      setEmbeddingSaving(false)
    }
  }

  async function handleRebuildIndex() {
    setRebuildingIndex(true)
    setRebuildMsg('')
    try {
      const res = await rebuildIndex()
      setRebuildMsg(`索引重建完成！共 ${res.total} 条，成功 ${res.indexed} 条${res.failed > 0 ? `，失败 ${res.failed} 条` : ''}`)
    } catch (e: any) {
      setRebuildMsg(e?.response?.data?.detail || '重建失败，请检查 Embedding API Key')
    } finally {
      setRebuildingIndex(false)
    }
  }

  async function handleSaveDeepSeek() {
    if (!deepseekApiKey) return
    setDeepseekSaving(true)
    setDeepseekMsg('')
    try {
      await saveDeepSeekConfig({ api_key: deepseekApiKey, base_url: deepseekBaseUrl, model: deepseekModel })
      setDeepseekMsg('配置保存成功！')
      setShowDeepSeekForm(false)
      setDeepseekApiKey('')
      const cfg = await getOcrConfig()
      setOcrConfig(cfg)
    } catch (e: any) {
      setDeepseekMsg(e?.response?.data?.detail || '保存失败')
    } finally {
      setDeepseekSaving(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* 新建科目 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-800">科目管理</h2>
        <div className="flex gap-2 mb-3">
          <input
            className="border rounded-lg px-3 py-2 flex-1 text-sm"
            placeholder="新建科目，如：一建实务"
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
          />
          <button
            onClick={handleAddSubject}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
          >
            新建科目
          </button>
        </div>
        {subjects.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {subjects.map(s => (
              <span key={s.id} className="bg-indigo-50 text-indigo-700 text-xs px-3 py-1 rounded-full border border-indigo-200">
                {s.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 新建章节 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-800">新建章节</h2>
        <div className="mb-3">
          <label className="block text-sm text-gray-600 mb-1">选择所属科目</label>
          <select
            className="border rounded-lg px-3 py-2 w-full text-sm"
            value={subjectId}
            onChange={e => setSubjectId(Number(e.target.value) || '')}
          >
            <option value="">-- 请先选择科目 --</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        {subjectId !== '' && (
          <div className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-2 flex-1 text-sm"
              placeholder="章节名称，如：第十章 施工成本管理"
              value={newChapter}
              onChange={e => setNewChapter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddChapter()}
            />
            <button
              onClick={handleAddChapter}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              创建章节
            </button>
          </div>
        )}
      </div>

      {/* 导入内容 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-800">导入内容</h2>

        {/* 选科目 */}
        <div className="mb-3">
          <label className="block text-sm text-gray-600 mb-1">选择科目</label>
          <select
            className="border rounded-lg px-3 py-2 w-full text-sm"
            value={subjectId}
            onChange={e => setSubjectId(Number(e.target.value) || '')}
          >
            <option value="">-- 选择科目 --</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        {/* 选章节 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">选择章节</label>
          <select
            className="border rounded-lg px-3 py-2 w-full text-sm"
            value={chapterId}
            onChange={e => setChapterId(Number(e.target.value) || '')}
            disabled={subjectId === ''}
          >
            <option value="">{subjectId === '' ? '-- 请先选择科目 --' : '-- 选择章节 --'}</option>
            {chapters.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* 导入模式 */}
        <div className="mb-4 flex gap-3">
          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            文本导入
          </button>
          <button
            onClick={() => setMode('image')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            图片OCR导入
          </button>
          <button
            onClick={() => setMode('image_card')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'image_card' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            图片总结卡
          </button>
        </div>

        {mode === 'text' ? (
          <textarea
            className="border rounded-lg w-full p-3 text-sm h-40 resize-none"
            placeholder="粘贴章节内容，系统将自动拆分为最小知识点..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        ) : mode === 'image_card' ? (
          <div>
            <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-sm font-medium text-purple-800 mb-1">图片总结卡模式</div>
              <div className="text-xs text-purple-600">
                上传思维导图、归纳表格、总结图片等，AI 将分析图片全部内容，生成一条完整的结构化知识笔记。
                <br />不拆分知识点，整张图片对应一条 <span className="font-mono bg-purple-100 px-1 rounded">image_card</span> 类型记录，导出后可被 OpenClaw 检索。
              </div>
              {!ocrConfig?.vision_configured && (
                <div className="mt-2 text-xs text-orange-600 font-medium">
                  ⚠ 请先在下方「图片AI识别配置」中填入 GPT-4o-mini API Key
                </div>
              )}
            </div>
            <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
              <input type="file" accept="image/*" className="hidden" id="card-upload"
                onChange={e => setFile(e.target.files?.[0] || null)} />
              <label htmlFor="card-upload" className="cursor-pointer text-purple-600 hover:underline text-sm">
                {file ? file.name : '点击上传总结图片（思维导图、表格、流程图等）'}
              </label>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-2 font-medium">识别方式</label>
              <div className="space-y-2">
                {/* GPT-4o-mini 视觉识别 */}
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  ocrEngine === 'vision' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}>
                  <input type="radio" name="ocr_engine" value="vision"
                    checked={ocrEngine === 'vision'} onChange={() => setOcrEngine('vision')}
                    className="accent-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">
                      GPT-4o-mini 视觉识别
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">推荐</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">图片直接由 AI 识别并拆分为知识点，理解图表结构</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs ${ocrConfig?.vision_configured ? 'text-green-600' : 'text-orange-500'}`}>
                      {ocrConfig?.vision_configured ? `✓ ${ocrConfig.vision_api_key_preview}` : '⚠ 未配置'}
                    </span>
                  </div>
                </label>

                {/* 百度 OCR */}
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  ocrEngine === 'baidu' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}>
                  <input type="radio" name="ocr_engine" value="baidu"
                    checked={ocrEngine === 'baidu'} onChange={() => setOcrEngine('baidu')}
                    className="accent-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">百度 OCR</div>
                    <div className="text-xs text-gray-500 mt-0.5">先提取文字，再由 AI 拆分知识点</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs ${ocrConfig?.baidu_configured ? 'text-green-600' : 'text-gray-400'}`}>
                      {ocrConfig?.baidu_configured ? `✓ ${ocrConfig.baidu_api_key_preview}` : '未配置'}
                    </span>
                    <button type="button"
                      onClick={e => { e.preventDefault(); setShowBaiduForm(v => !v) }}
                      className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50">
                      {showBaiduForm ? '收起' : '修改'}
                    </button>
                  </div>
                </label>
                {showBaiduForm && (
                  <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
                    <div className="text-xs font-medium text-gray-700 mb-1">
                      百度OCR配置
                      <a href="https://console.bce.baidu.com/ai/#/ai/ocr/app/list" target="_blank" rel="noopener noreferrer"
                        className="ml-2 text-blue-500 hover:underline font-normal">前往百度控制台获取 →</a>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">API Key</label>
                      <input className="border rounded-lg px-3 py-2 w-full text-sm" placeholder="输入百度 API Key"
                        value={baiduApiKey} onChange={e => setBaiduApiKey(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Secret Key</label>
                      <input type="password" className="border rounded-lg px-3 py-2 w-full text-sm" placeholder="输入百度 Secret Key"
                        value={baiduSecretKey} onChange={e => setBaiduSecretKey(e.target.value)} />
                    </div>
                    {baiduMsg && (
                      <div className={`text-xs ${baiduMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{baiduMsg}</div>
                    )}
                    <button onClick={handleSaveOcr} disabled={baiduSaving || !baiduApiKey || !baiduSecretKey}
                      className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {baiduSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                )}

                {/* 本地 */}
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  ocrEngine === 'local' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                }`}>
                  <input type="radio" name="ocr_engine" value="local"
                    checked={ocrEngine === 'local'} onChange={() => setOcrEngine('local')}
                    className="accent-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">本地识别</div>
                    <div className="text-xs text-gray-500 mt-0.5">使用本地 EasyOCR（首次需下载约 500MB 模型）</div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">离线可用</span>
                </label>
              </div>
            </div>

            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input type="file" accept="image/*" className="hidden" id="img-upload"
                onChange={e => setFile(e.target.files?.[0] || null)} />
              <label htmlFor="img-upload" className="cursor-pointer text-blue-600 hover:underline text-sm">
                {file ? file.name : '点击上传图片（支持书页截图、扫描件）'}
              </label>
            </div>
          </div>
        )}

        <div className="mt-3">
          <input
            className="border rounded-lg px-3 py-2 w-full text-sm"
            placeholder="来源标注（可选，如：教材第3章）"
            value={source}
            onChange={e => setSource(e.target.value)}
          />
        </div>

        <div className="mt-4 flex gap-3">
          {mode === 'text' && (
            <button
              onClick={handlePreview}
              disabled={loading || !content || !chapterId}
              className="px-4 py-2 rounded-lg text-sm border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              预览拆分
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={loading || (mode === 'text' ? !content : !file) || !chapterId}
            className={`text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50 ${
              mode === 'image_card'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? '处理中...' : mode === 'image_card' ? 'AI分析入库' : '导入入库'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-700 mb-3">预览拆分结果（共 {preview.count} 个知识点，未入库）</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {preview.points.map((p: any, i: number) => (
              <div key={i} className="border rounded-lg p-3 text-sm">
                <div className="font-medium text-blue-800">{p.title}</div>
                <div className="text-gray-600 mt-1 line-clamp-3">{p.content}</div>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {p.tags?.map((t: string) => (
                    <span key={t} className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">{t}</span>
                  ))}
                  <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded">难度 {p.difficulty}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          <div className="font-bold mb-1">操作失败</div>
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
          <div className="font-bold text-green-700 mb-1">
            {result.status === 'duplicate' ? '⚠ 内容已存在' : '导入成功'}
          </div>
          {result.status === 'duplicate' ? (
            <div className="text-orange-600">{result.message}</div>
          ) : result.title ? (
            <div className="text-green-600">
              <div>已生成图片总结卡：<span className="font-medium">{result.title}</span></div>
              {result.content_preview && (
                <div className="mt-2 text-gray-500 text-xs bg-white p-2 rounded border">{result.content_preview}</div>
              )}
            </div>
          ) : (
            <div className="text-green-600">
              共导入 {result.imported} 条
              {(result.knowledge_count != null || result.example_count != null) && (
                <span className="ml-1 text-gray-500">
                  （知识点 {result.knowledge_count ?? 0} 条，例题 {result.example_count ?? 0} 道）
                </span>
              )}
            </div>
          )}
          {result.ocr_text && (
            <div className="mt-2 text-gray-500">OCR识别：{result.ocr_text}</div>
          )}
        </div>
      )}

      {/* 图片AI识别配置 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-bold text-gray-700 mb-3">图片 AI 识别配置（GPT-4o-mini）</h3>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm text-gray-600">
              视觉模型：<span className="font-mono text-blue-700">{ocrConfig?.vision_model || 'gpt-4o-mini'}</span>
              <span className="ml-2 text-xs text-gray-400">（{ocrConfig?.vision_base_url || 'https://api.apimart.ai/v1'}）</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {ocrConfig?.vision_configured
                ? `✓ 已配置 ${ocrConfig.vision_api_key_preview}`
                : '⚠ 未配置 API Key，图片视觉识别和图片总结卡功能不可用'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVisionForm(v => !v)}
            className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50"
          >
            {showVisionForm ? '收起' : '配置'}
          </button>
        </div>
        {visionMsg && (
          <div className={`text-xs mb-2 ${visionMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{visionMsg}</div>
        )}
        {showVisionForm && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
            <div className="text-xs font-medium text-gray-700 mb-1">
              GPT-4o-mini API Key
              <a href="https://docs.apimart.ai/cn" target="_blank" rel="noopener noreferrer"
                className="ml-2 text-blue-500 hover:underline font-normal">查看文档 →</a>
            </div>
            <input type="password" className="border rounded-lg px-3 py-2 w-full text-sm"
              placeholder="输入 API Key（sk-...）"
              value={visionApiKey} onChange={e => setVisionApiKey(e.target.value)} />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Base URL</label>
              <input className="border rounded-lg px-3 py-2 w-full text-sm font-mono"
                value={visionBaseUrl} onChange={e => setVisionBaseUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">模型名称</label>
              <input className="border rounded-lg px-3 py-2 w-full text-sm font-mono"
                value={visionModel} onChange={e => setVisionModel(e.target.value)} />
            </div>
            <button onClick={handleSaveVision} disabled={visionSaving || !visionApiKey}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {visionSaving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>

      {/* 语义搜索配置 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-bold text-gray-700 mb-3">语义搜索配置</h3>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm text-gray-600">
              当前模型：<span className="font-mono text-blue-700">{ocrConfig?.embedding_model || 'BAAI/bge-large-zh-v1.5'}</span>
              <span className="ml-2 text-xs text-gray-400">（硅基流动）</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {ocrConfig?.embedding_configured
                ? `✓ 已配置 ${ocrConfig.embedding_api_key_preview}`
                : '⚠ 未配置 Embedding API Key，语义搜索不可用'}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRebuildIndex}
              disabled={rebuildingIndex || !ocrConfig?.embedding_configured}
              className="text-xs text-green-700 border border-green-400 rounded px-2 py-0.5 hover:bg-green-50 disabled:opacity-40"
            >
              {rebuildingIndex ? '重建中...' : '重建索引'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmbeddingForm(v => !v)}
              className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50"
            >
              {showEmbeddingForm ? '收起' : '配置'}
            </button>
          </div>
        </div>
        {rebuildMsg && (
          <div className={`text-xs mb-2 ${rebuildMsg.includes('完成') ? 'text-green-600' : 'text-red-500'}`}>{rebuildMsg}</div>
        )}
        {embeddingMsg && (
          <div className={`text-xs mb-2 ${embeddingMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{embeddingMsg}</div>
        )}
        {showEmbeddingForm && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
            <div className="text-xs font-medium text-gray-700 mb-1">
              硅基流动 API Key
              <a href="https://cloud.siliconflow.cn/account/ak" target="_blank" rel="noopener noreferrer"
                className="ml-2 text-blue-500 hover:underline font-normal">前往硅基流动获取 →</a>
            </div>
            <input type="password" className="border rounded-lg px-3 py-2 w-full text-sm"
              placeholder="输入硅基流动 API Key（sk-...）"
              value={embeddingApiKey} onChange={e => setEmbeddingApiKey(e.target.value)} />
            <p className="text-xs text-amber-600">⚠ 保存后需点击"重建索引"，将所有知识点重新向量化。</p>
            <button onClick={handleSaveEmbedding} disabled={embeddingSaving || !embeddingApiKey}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {embeddingSaving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>

      {/* DeepSeek AI 配置 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-bold text-gray-700 mb-3">DeepSeek AI 配置（deepseek-chat）</h3>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm text-gray-600">
              当前模型：<span className="font-mono text-blue-700">{ocrConfig?.deepseek_model || 'deepseek-chat'}</span>
              <span className="ml-2 text-xs text-gray-400">（{ocrConfig?.deepseek_base_url || 'https://api.deepseek.com/v1'}）</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {ocrConfig?.deepseek_configured
                ? `✓ 已配置 ${ocrConfig.deepseek_api_key_preview}`
                : '⚠ 未配置 API Key，AI 知识点拆分、问答和出题功能不可用'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDeepSeekForm(v => !v)}
            className="text-xs text-blue-600 border border-blue-300 rounded px-2 py-0.5 hover:bg-blue-50"
          >
            {showDeepSeekForm ? '收起' : '配置'}
          </button>
        </div>
        {deepseekMsg && (
          <div className={`text-xs mb-2 ${deepseekMsg.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{deepseekMsg}</div>
        )}
        {showDeepSeekForm && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
            <div className="text-xs font-medium text-gray-700 mb-1">
              DeepSeek API Key
              <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer"
                className="ml-2 text-blue-500 hover:underline font-normal">前往 DeepSeek 控制台获取 →</a>
            </div>
            <input type="password" className="border rounded-lg px-3 py-2 w-full text-sm"
              placeholder="输入 API Key（sk-...）"
              value={deepseekApiKey} onChange={e => setDeepseekApiKey(e.target.value)} />
            <div>
              <label className="text-xs text-gray-500 block mb-1">Base URL</label>
              <input className="border rounded-lg px-3 py-2 w-full text-sm font-mono"
                value={deepseekBaseUrl} onChange={e => setDeepseekBaseUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">模型名称</label>
              <input className="border rounded-lg px-3 py-2 w-full text-sm font-mono"
                placeholder="如：deepseek-chat / deepseek-reasoner"
                value={deepseekModel} onChange={e => setDeepseekModel(e.target.value)} />
            </div>
            <p className="text-xs text-amber-600">⚠ 此配置影响所有 AI 功能：知识点拆分、AI 问答、自动出题。</p>
            <button onClick={handleSaveDeepSeek} disabled={deepseekSaving || !deepseekApiKey}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {deepseekSaving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
