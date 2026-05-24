'use client'
import { useState } from 'react'
import { login } from '@/lib/api'
import { setStudyToken, setAdminToken } from '@/lib/auth'

interface Props {
  role: 'admin' | 'study'
  onSuccess: () => void
}

export default function LoginModal({ role, onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = role === 'admin'
  const title = isAdmin ? '管理后台登录' : '学习端登录'
  const subtitle = isAdmin ? '请输入管理员凭据继续' : '欢迎回来，请登录学习账号'
  const icon = isAdmin ? '🗂️' : '📖'
  const meshClass = isAdmin ? 'bg-mesh-indigo' : 'bg-mesh-emerald'
  const brandGradient = isAdmin
    ? 'from-indigo-500 to-violet-600'
    : 'from-emerald-500 to-teal-600'
  const brandShadow = isAdmin
    ? 'shadow-indigo-500/30'
    : 'shadow-emerald-500/30'
  const textGradient = isAdmin ? 'text-gradient-indigo' : 'text-gradient-emerald'
  const focusRing = isAdmin
    ? 'focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]'
    : 'focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
  const btnClass = isAdmin ? 'btn-primary' : 'btn-emerald'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      setError('请输入账号和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await login({ username, password, role })
      if (role === 'admin') {
        setAdminToken(data.token)
      } else {
        setStudyToken(data.token)
      }
      onSuccess()
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '账号或密码错误'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`relative min-h-screen flex flex-col items-center justify-center px-6 py-10 overflow-hidden ${meshClass}`}>
      {/* 顶部装饰光晕 */}
      <div className={`absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-50 pointer-events-none bg-gradient-to-br ${brandGradient}`} style={{ filter: 'blur(120px)' }} />

      {/* 返回首页 */}
      <a href="/" className="absolute top-6 left-6 text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1.5">
        <span aria-hidden>←</span> 返回首页
      </a>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* 品牌徽章 */}
        <div className="flex flex-col items-center mb-6">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${brandGradient} flex items-center justify-center text-3xl shadow-lg ${brandShadow} mb-4`}>
            {icon}
          </div>
          <div className="text-xs text-gray-500 mb-1">一级建造师知识库系统</div>
          <h2 className={`text-2xl font-bold ${textGradient}`}>{title}</h2>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>

        {/* 玻璃卡 */}
        <div className="card-surface p-7 backdrop-blur-xl bg-white/85">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">账号</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={`input-base ${focusRing}`}
                placeholder="请输入账号"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`input-base ${focusRing}`}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <span aria-hidden>⚠</span>{error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`${btnClass} w-full py-2.5`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  登录中...
                </span>
              ) : '登录'}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} 一建知识库系统
        </div>
      </div>
    </div>
  )
}
