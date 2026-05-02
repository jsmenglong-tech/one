'use client'
import { useState, useEffect } from 'react'
import { getStudyUsers, createStudyUser, deleteStudyUser, changeAdminPassword } from '@/lib/api'

interface StudyUser {
  id: number
  username: string
  created_at: string
}

export default function AccountTab() {
  const [users, setUsers] = useState<StudyUser[]>([])
  const [loading, setLoading] = useState(true)

  // 新增账号
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')
  const [createError, setCreateError] = useState('')

  // 修改管理员密码
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdError, setPwdError] = useState('')

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await getStudyUsers()
      setUsers(data.users || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername || !newPassword) {
      setCreateError('账号和密码不能为空')
      return
    }
    setCreating(true)
    setCreateMsg('')
    setCreateError('')
    try {
      await createStudyUser({ username: newUsername, password: newPassword })
      setCreateMsg(`账号 "${newUsername}" 创建成功`)
      setNewUsername('')
      setNewPassword('')
      loadUsers()
    } catch (e: any) {
      setCreateError(e?.response?.data?.detail || '创建失败')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(user: StudyUser) {
    if (!confirm(`确定删除账号 "${user.username}"？`)) return
    try {
      await deleteStudyUser(user.id)
      loadUsers()
    } catch (e: any) {
      alert(e?.response?.data?.detail || '删除失败')
    }
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault()
    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdError('请填写所有字段')
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdError('两次输入的新密码不一致')
      return
    }
    setPwdLoading(true)
    setPwdMsg('')
    setPwdError('')
    try {
      await changeAdminPassword({ old_password: oldPwd, new_password: newPwd })
      setPwdMsg('密码已更新，下次登录时生效')
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
    } catch (e: any) {
      setPwdError(e?.response?.data?.detail || '修改失败')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* 学习端账号列表 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">学习端账号管理</h2>

        {/* 新增表单 */}
        <form onSubmit={handleCreate} className="flex gap-3 mb-5 flex-wrap">
          <input
            type="text"
            placeholder="新账号"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="密码"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? '创建中...' : '+ 添加账号'}
          </button>
        </form>
        {createMsg && <p className="text-green-600 text-sm mb-3">{createMsg}</p>}
        {createError && <p className="text-red-500 text-sm mb-3">{createError}</p>}

        {/* 账号列表 */}
        {loading ? (
          <p className="text-gray-400 text-sm">加载中...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无学习端账号</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">账号</th>
                <th className="pb-2 font-medium">创建时间</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2.5 font-mono">{u.username}</td>
                  <td className="py-2.5 text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleDelete(u)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 修改管理员密码 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">修改管理员密码</h2>
        <form onSubmit={handleChangePwd} className="space-y-3 max-w-sm">
          <div>
            <label className="block text-sm text-gray-600 mb-1">当前密码</label>
            <input
              type="password"
              value={oldPwd}
              onChange={e => setOldPwd(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">新密码</label>
            <input
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {pwdMsg && <p className="text-green-600 text-sm">{pwdMsg}</p>}
          {pwdError && <p className="text-red-500 text-sm">{pwdError}</p>}
          <button
            type="submit"
            disabled={pwdLoading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {pwdLoading ? '保存中...' : '保存新密码'}
          </button>
        </form>
      </div>
    </div>
  )
}
