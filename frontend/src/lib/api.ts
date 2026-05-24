import axios from 'axios'
import { getStudyToken, getAdminToken } from './auth'

const BASE = '/api'

export const api = axios.create({ baseURL: BASE })

// 请求拦截器：自动附带 token
api.interceptors.request.use((config) => {
  const adminToken = getAdminToken()
  const studyToken = getStudyToken()
  const token = adminToken || studyToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})



// 科目（顶级节点）
export const getSubjects = () => api.get('/chapters/subjects').then(r => r.data)
export const createSubject = (data: { title: string; sort_order?: number }) =>
  api.post('/chapters/subjects', data).then(r => r.data)
export const updateSubject = (id: number, data: { title: string }) =>
  api.put(`/chapters/subjects/${id}`, data).then(r => r.data)
export const deleteSubject = (id: number, force = false) =>
  api.delete(`/chapters/subjects/${id}`, { params: { force } }).then(r => r.data)

// 章节
export const getChapters = (params?: { subject_id?: number }) =>
  api.get('/chapters/', { params }).then(r => r.data)
export const createChapter = (data: any) => api.post('/chapters/', data).then(r => r.data)
export const updateChapter = (id: number, data: { title: string }) =>
  api.put(`/chapters/${id}`, data).then(r => r.data)
export const deleteChapter = (id: number, force = false) =>
  api.delete(`/chapters/${id}`, { params: { force } }).then(r => r.data)

// 知识点
export const getKnowledge = (params?: any) => api.get('/knowledge/list', { params }).then(r => r.data)
export const addKnowledge = (data: any) => api.post('/knowledge/add', data).then(r => r.data)
export const updateKnowledge = (id: string, data: any) => api.put(`/knowledge/${id}`, data).then(r => r.data)
export const deleteKnowledge = (id: string) => api.delete(`/knowledge/${id}`).then(r => r.data)
export const batchDeleteKnowledge = (ids: string[]) => api.post('/knowledge/batch-delete', { ids }).then(r => r.data)
export const importChapter = (data: any) => api.post('/knowledge/import-chapter', data).then(r => r.data)
export const previewSplit = (data: any) => api.post('/knowledge/preview-split', data).then(r => r.data)
export const searchKnowledge = (q: string, top_k = 5) =>
  api.get('/knowledge/search', { params: { q, top_k } }).then(r => r.data)
export const rebuildIndex = () => api.post('/knowledge/rebuild-index').then(r => r.data)

export const importImage = (chapter_id: number, file: File, source?: string, ocr_engine: string = 'deepseek') => {
  const form = new FormData()
  form.append('chapter_id', String(chapter_id))
  form.append('file', file)
  form.append('ocr_engine', ocr_engine)
  if (source) form.append('source', source)
  return api.post('/knowledge/import-image', form).then(r => r.data)
}

// 题目
export const getQuestions = (params?: any) => api.get('/questions/list', { params }).then(r => r.data)
export const generateQuestion = (data: any) => api.post('/questions/generate', data).then(r => r.data)
export const generateQuestionBatch = (data: any) => api.post('/questions/generate-batch', data).then(r => r.data)
export const recordWrong = (question_id: string) => api.post(`/questions/wrong/${question_id}`).then(r => r.data)
export const getWrongRecords = () => api.get('/questions/wrong').then(r => r.data)

// 系统配置
export const getOcrConfig = () => api.get('/settings/ocr').then(r => r.data)
export const saveBaiduOcr = (data: { api_key: string; secret_key: string }) =>
  api.post('/settings/ocr/baidu', data).then(r => r.data)
export const saveDeepSeekConfig = (data: { api_key: string; base_url?: string; model?: string }) =>
  api.post('/settings/ocr/deepseek', data).then(r => r.data)
export const saveEmbeddingConfig = (data: { api_key: string; base_url?: string; model?: string }) =>
  api.post('/settings/embedding', data).then(r => r.data)
export const saveCardConfig = (data: { api_key: string; base_url?: string; model?: string }) =>
  api.post('/settings/card', data).then(r => r.data)

export const addImageCard = (chapter_id: number, file: File, source?: string) => {
  const form = new FormData()
  form.append('chapter_id', String(chapter_id))
  form.append('file', file)
  if (source) form.append('source', source)
  return api.post('/knowledge/add-image-card', form).then(r => r.data)
}

// AI 解释知识点（SSE 流式）
export async function explainKnowledge(
  title: string,
  content: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  try {
    const resp = await fetch('/api/knowledge/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    })
    if (!resp.ok) {
      onError(`请求失败：${resp.status}`)
      return
    }
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') { onDone(); return }
          if (data.startsWith('[ERROR]')) { onError(data.slice(8)); return }
          // 后端用 JSON 编码，解析还原换行符等特殊字符
          try {
            onChunk(JSON.parse(data))
          } catch {
            onChunk(data)
          }
        }
      }
    }
    onDone()
  } catch (e: any) {
    onError(e.message || '未知错误')
  }
}

// 导出
export const exportKnowledgePack = (params?: { subject_id?: number; chapter_id?: number }) =>
  api.get('/export/knowledge-pack', { params, responseType: 'blob' }).then(r => {
    const disposition = r.headers['content-disposition'] || ''
    const match = disposition.match(/filename=(.+)/)
    const filename = match ? match[1].replace(/"/g, '') : 'knowledge-pack.zip'
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  })

// 导入知识包
export const importKnowledgePack = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/export/import-pack', form).then(r => r.data)
}

// 认证
export const login = (data: { username: string; password: string; role: 'admin' | 'study' }) =>
  api.post('/auth/login', data).then(r => r.data)

// 学习端账号管理（管理员使用）
export const getStudyUsers = () => api.get('/auth/study-users').then(r => r.data)
export const createStudyUser = (data: { username: string; password: string }) =>
  api.post('/auth/study-users', data).then(r => r.data)
export const deleteStudyUser = (id: number) =>
  api.delete(`/auth/study-users/${id}`).then(r => r.data)
export const changeAdminPassword = (data: { old_password: string; new_password: string }) =>
  api.post('/auth/change-admin-password', data).then(r => r.data)

