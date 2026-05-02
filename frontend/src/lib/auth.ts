const TOKEN_KEY_STUDY = 'jzs_study_token'
const TOKEN_KEY_ADMIN = 'jzs_admin_token'

export function getStudyToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY_STUDY)
}

export function setStudyToken(token: string) {
  localStorage.setItem(TOKEN_KEY_STUDY, token)
}

export function clearStudyToken() {
  localStorage.removeItem(TOKEN_KEY_STUDY)
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY_ADMIN)
}

export function setAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY_ADMIN, token)
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY_ADMIN)
}

/** 解析 JWT payload（不校验签名，仅读取 exp） */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export function isStudyLoggedIn(): boolean {
  const t = getStudyToken()
  return !!t && !isTokenExpired(t)
}

export function isAdminLoggedIn(): boolean {
  const t = getAdminToken()
  return !!t && !isTokenExpired(t)
}
