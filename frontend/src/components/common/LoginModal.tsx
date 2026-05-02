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
  const themeColor = isAdmin ? 'blue' : 'green'
  const title = isAdmin ? '管理后台登录' : '学习端登录'
  const headerBg = isAdmin ? 'bg-blue-900' : 'bg-green-800'
  const btnBg = isAdmin
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-green-600 hover:bg-green-700'

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className={`${headerBg} text-white px-8 py-4`}>
        <h1 className="text-xl font-bold">一级建造师知识库系统</h1>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{title}</h2>
          <p className="text-gray-400 text-sm mb-6">请输入账号和密码继续</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">账号</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入账号"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${btnBg} text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50`}
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
