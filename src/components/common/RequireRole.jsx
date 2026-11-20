import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const hasToken = () => {
  try {
    return Boolean(localStorage.getItem('smartlabkit_token'))
  } catch {
    return false
  }
}

/**
 * Chặn trang theo vai trò: chưa đăng nhập thì về /login, sai vai trò thì về trang chính của vai trò mình.
 * Backend vẫn kiểm tra quyền ở từng API; lớp này chỉ để người dùng không mở được trang không dành cho mình.
 */
export default function RequireRole({ roles, children }) {
  const { user, hasRole } = useAuth()

  if (!user || !hasToken()) return <Navigate to="/login" replace />
  if (roles && !roles.some((role) => hasRole(role))) {
    return <Navigate to={user.defaultRoute || '/class-setup'} replace />
  }
  return children
}
