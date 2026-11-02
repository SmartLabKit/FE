/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'

export const VALID_ROLES = ['Admin', 'Student', 'Lecturer', 'LabStaff', 'InventoryManager']

const rolesByKey = new Map(VALID_ROLES.map((role) => [role.toLowerCase(), role]))

export function normalizeRole(role) {
  if (typeof role !== 'string') return null
  return rolesByKey.get(role.trim().toLowerCase()) || null
}

// Các tài khoản demo mặc định cho các Actor
export const DEMO_ACCOUNTS = {
  ADMIN: {
    userId: 'u-admin-01',
    email: 'admin@smartlabkit.vn',
    password: 'admin123',
    name: 'Nguyễn Văn Minh',
    fullName: 'Nguyễn Văn Minh',
    username: 'admin',
    roleLabel: 'ADMIN',
    roles: ['Admin'],
    permissions: ['USER_VIEW', 'USER_MANAGE', 'ROLE_MANAGE', 'SEMESTER_MANAGE', 'CLASS_MANAGE', 'COMPONENT_MANAGE', 'STOCK_INWARD'],
    title: 'Quản trị hệ thống / Lab Staff',
    avatarBg: '#0058be',
    badgeColor: '#0058be',
    defaultRoute: '/class-setup/admin/semesters',
  },
  LECTURER: {
    userId: 'u-lecturer-01',
    email: 'lecturer@smartlabkit.vn',
    password: 'lecturer123',
    name: 'Dr. Evelyn Stone',
    fullName: 'Dr. Evelyn Stone',
    username: 'dr_stone',
    roleLabel: 'LECTURER',
    roles: ['Lecturer'],
    permissions: ['COMPONENT_VIEW', 'CLASS_MANAGE', 'PROJECT_APPROVE', 'BORROW_APPROVE'],
    title: 'Giảng viên phụ trách môn',
    avatarBg: '#0284c7',
    badgeColor: '#0284c7',
    defaultRoute: '/borrow/my-requests',
  },
  STUDENT: {
    userId: 'u-student-01',
    email: 'student@smartlabkit.vn',
    password: 'student123',
    name: 'Lê Hoàng Nam',
    fullName: 'Lê Hoàng Nam',
    username: 'sv_namlh',
    roleLabel: 'STUDENT',
    roles: ['Student'],
    permissions: ['COMPONENT_VIEW', 'BORROW_REQUEST'],
    title: 'Sinh viên / Nhóm trưởng',
    avatarBg: '#059669',
    badgeColor: '#059669',
    defaultRoute: '/class-setup/student/groups',
  },
}

// Hàm chuẩn hóa thông tin người dùng từ Backend DTO sang Frontend User Object
export function normalizeUser(rawUser) {
  if (!rawUser) return null

  const rawRoles = Array.isArray(rawUser.roles)
    ? rawUser.roles
    : [rawUser.role || rawUser.roleLabel].filter(Boolean)
  const roles = [...new Set(rawRoles.map(normalizeRole).filter(Boolean))]
  if (roles.length === 0) return null

  const primaryRole = roles[0]
  const roleUpper = primaryRole.toUpperCase()

  let defaultRoute = '/class-setup'
  let avatarBg = '#0058be'
  let badgeColor = '#0058be'

  if (roleUpper === 'ADMIN') {
    defaultRoute = '/class-setup/admin/semesters'
    avatarBg = '#0058be'
    badgeColor = '#0058be'
  } else if (roleUpper === 'LECTURER') {
    defaultRoute = '/borrow/my-requests'
    avatarBg = '#0284c7'
    badgeColor = '#0284c7'
  } else if (roleUpper === 'STUDENT') {
    defaultRoute = '/class-setup/student/groups'
    avatarBg = '#059669'
    badgeColor = '#059669'
  } else if (roleUpper === 'LABSTAFF') {
    defaultRoute = '/class-setup/admin/components'
    avatarBg = '#7c3aed'
    badgeColor = '#7c3aed'
  } else if (roleUpper === 'INVENTORYMANAGER') {
    defaultRoute = '/class-setup/admin/stock-inwards'
    avatarBg = '#0d9488'
    badgeColor = '#0d9488'
  }

  return {
    ...rawUser,
    userId: rawUser.userId || rawUser.id,
    name: rawUser.fullName || rawUser.name || rawUser.username || 'Người dùng',
    fullName: rawUser.fullName || rawUser.name || 'Người dùng',
    email: rawUser.email || '',
    username: rawUser.username || '',
    roleLabel: roleUpper,
    roles,
    permissions: Array.isArray(rawUser.permissions)
      ? rawUser.permissions.filter((permission) => typeof permission === 'string').map((permission) => permission.trim())
      : [],
    avatarBg,
    badgeColor,
    defaultRoute,
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('smartlabkit_token')
    const saved = localStorage.getItem('smartlabkit_user')
    if (!token || !saved) {
      localStorage.removeItem('smartlabkit_user')
      return null
    }

    try {
      const restoredUser = normalizeUser(JSON.parse(saved))
      if (!restoredUser) {
        localStorage.removeItem('smartlabkit_user')
        localStorage.removeItem('smartlabkit_token')
      }
      return restoredUser
    } catch (error) {
      console.error('Failed to parse saved user', error)
      localStorage.removeItem('smartlabkit_user')
      localStorage.removeItem('smartlabkit_token')
      return null
    }
  })

  const [loading, setLoading] = useState(false)

  // Đồng bộ user vào localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('smartlabkit_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('smartlabkit_user')
      localStorage.removeItem('smartlabkit_token')
    }
  }, [user])

  // Lấy thông tin user hiện tại nếu có token trên máy
  useEffect(() => {
    const token = localStorage.getItem('smartlabkit_token')
    if (token && !token.startsWith('mock-jwt-token-')) {
      let active = true
      authService
        .getMe()
        .then((fetchedUser) => {
          if (!active || localStorage.getItem('smartlabkit_token') !== token) return
          const normalized = normalizeUser(fetchedUser)
          if (!normalized) {
            throw new Error('Tài khoản không có role hợp lệ')
          }
          setUser(normalized)
        })
        .catch((error) => {
          if (!active || localStorage.getItem('smartlabkit_token') !== token) return
          console.error('Không thể xác thực phiên đăng nhập hiện tại', error)
          setUser(null)
          localStorage.removeItem('smartlabkit_user')
          localStorage.removeItem('smartlabkit_token')
        })

      return () => {
        active = false
      }
    }
  }, [])

  // Đăng nhập kết nối API
  const login = async (identifier, password) => {
    setLoading(true)
    try {
      const result = await authService.login({ identifier, password })
      if (result?.accessToken && result.user) {
        const normalized = normalizeUser(result.user)
        if (!normalized) {
          localStorage.removeItem('smartlabkit_token')
          setUser(null)
          return { success: false, error: 'Tài khoản không có role hợp lệ' }
        }
        setUser(normalized)
        return { success: true, user: normalized }
      }
      localStorage.removeItem('smartlabkit_token')
      setUser(null)
      return { success: false, error: 'Thông tin đăng nhập không hợp lệ hoặc tài khoản thiếu role' }
    } catch (err) {
      const status = err.cause?.response?.status
      const canUseDemoAccount = !status || status === 500
      const normalizedIdentifier = (identifier || '').trim().toLowerCase()
      const demoUser = canUseDemoAccount && Object.values(DEMO_ACCOUNTS).find(
        (account) =>
          (account.email.trim().toLowerCase() === normalizedIdentifier ||
            account.username.trim().toLowerCase() === normalizedIdentifier) &&
          account.password === password
      )

      if (demoUser) {
        localStorage.setItem('smartlabkit_token', 'mock-jwt-token-smartlabkit-demo-2026')
        setUser(demoUser)
        return { success: true, user: demoUser }
      }

      if (status === 401 || status === 403) {
        localStorage.removeItem('smartlabkit_token')
        setUser(null)
      }

      return { success: false, error: err.message || 'Đăng nhập không thành công' }
    } finally {
      setLoading(false)
    }
  }

  // Đăng nhập nhanh theo Role Demo
  const loginAsRole = (roleKey) => {
    const actorAccount = DEMO_ACCOUNTS[roleKey]
    if (!actorAccount || !normalizeRole(actorAccount.roles[0])) return null
    localStorage.setItem('smartlabkit_token', 'mock-jwt-token-smartlabkit-demo-2026')
    setUser(actorAccount)
    return actorAccount
  }

  // Cập nhật thông tin người dùng trong state
  const updateUser = useCallback((updatedData) => {
    setUser((prev) => {
      if (!prev) return null
      return normalizeUser({ ...prev, ...updatedData })
    })
  }, [])

  // Kiểm tra quyền (Permission)
  const hasPermission = useCallback(
    (permissionCode) => {
      if (!user || typeof permissionCode !== 'string') return false
      const requestedPermission = permissionCode.trim().toLowerCase()
      return user.permissions?.some(
        (permission) => permission.toLowerCase() === requestedPermission
      ) || false
    },
    [user]
  )

  // Kiểm tra vai trò (Role)
  const hasRole = useCallback(
    (roleName) => {
      const normalizedRole = normalizeRole(roleName)
      return Boolean(normalizedRole && user?.roles?.some((role) => normalizeRole(role) === normalizedRole))
    },
    [user]
  )

  // Đăng xuất gọi POST /api/auth/logout và giải phóng phiên
  const logout = async () => {
    try {
      await authService.logout()
    } catch (e) {
      console.warn('Lỗi khi đăng xuất:', e)
    } finally {
      setUser(null)
      localStorage.removeItem('smartlabkit_user')
      localStorage.removeItem('smartlabkit_token')
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginAsRole,
        updateUser,
        hasPermission,
        hasRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
