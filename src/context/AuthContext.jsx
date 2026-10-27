/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'

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
    defaultRoute: '/class-setup/lecturer/quotas',
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

  const roles = Array.isArray(rawUser.roles) ? rawUser.roles : []
  const primaryRole = roles[0] || 'Admin'
  const roleUpper = primaryRole.toUpperCase()

  let defaultRoute = '/class-setup'
  let avatarBg = '#0058be'
  let badgeColor = '#0058be'

  if (roleUpper === 'ADMIN') {
    defaultRoute = '/class-setup/admin/semesters'
    avatarBg = '#0058be'
    badgeColor = '#0058be'
  } else if (roleUpper === 'LECTURER') {
    defaultRoute = '/class-setup/lecturer/quotas'
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
    roles: roles.length > 0 ? roles : [primaryRole],
    permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : [],
    avatarBg,
    badgeColor,
    defaultRoute,
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smartlabkit_user')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return normalizeUser(parsed)
      } catch (e) {
        console.error('Failed to parse saved user', e)
      }
    }
    // Mặc định đăng nhập Admin khi khởi chạy nếu chưa có
    return DEMO_ACCOUNTS.ADMIN
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
    if (token && (!user || user.email === DEMO_ACCOUNTS.ADMIN.email)) {
      authService
        .getMe()
        .then((fetchedUser) => {
          if (fetchedUser) {
            setUser(normalizeUser(fetchedUser))
          }
        })
        .catch(() => {
          // Nếu không lấy được, giữ nguyên tài khoản hiện tại
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đăng nhập kết nối API
  const login = async (identifier, password) => {
    setLoading(true)
    try {
      const result = await authService.login({ identifier, password })
      if (result && result.user) {
        const normalized = normalizeUser(result.user)
        setUser(normalized)
        return { success: true, user: normalized }
      }
      return { success: false, error: 'Không nhận được dữ liệu người dùng' }
    } catch (err) {
      // Fallback kiểm tra DEMO_ACCOUNTS nếu gõ tài khoản demo
      const foundActorKey = Object.keys(DEMO_ACCOUNTS).find(
        (key) => DEMO_ACCOUNTS[key].email.toLowerCase() === (identifier || '').toLowerCase()
      )
      if (foundActorKey && DEMO_ACCOUNTS[foundActorKey].password === password) {
        const demoUser = DEMO_ACCOUNTS[foundActorKey]
        setUser(demoUser)
        return { success: true, user: demoUser }
      }

      return { success: false, error: err.message || 'Đăng nhập không thành công' }
    } finally {
      setLoading(false)
    }
  }

  // Đăng nhập nhanh theo Role Demo
  const loginAsRole = (roleKey) => {
    const actorAccount = DEMO_ACCOUNTS[roleKey] || DEMO_ACCOUNTS.ADMIN
    setUser(actorAccount)
    return actorAccount
  }

  // Cập nhật thông tin người dùng trong state
  const updateUser = useCallback((updatedData) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedData }
      return normalizeUser(merged)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Kiểm tra quyền (Permission)
  const hasPermission = useCallback(
    (permissionCode) => {
      if (!user) return false
      // Admin luôn có toàn quyền
      if (user.roles?.includes('Admin') || user.roleLabel === 'ADMIN') return true
      return user.permissions?.includes(permissionCode) || false
    },
    [user]
  )

  // Kiểm tra vai trò (Role)
  const hasRole = useCallback(
    (roleName) => {
      if (!user) return false
      return user.roles?.some((r) => r.toLowerCase() === roleName.toLowerCase()) || false
    },
    [user]
  )

  // Đăng xuất
  const logout = () => {
    setUser(null)
    localStorage.removeItem('smartlabkit_user')
    localStorage.removeItem('smartlabkit_token')
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
