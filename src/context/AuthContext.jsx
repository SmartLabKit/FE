import { createContext, useContext, useState, useEffect } from 'react'

// Các tài khoản demo mặc định cho 3 Actor
export const DEMO_ACCOUNTS = {
  ADMIN: {
    email: 'admin@smartlabkit.vn',
    password: 'admin123',
    name: 'Nguyễn Văn Minh',
    roleLabel: 'ADMIN',
    title: 'Quản trị hệ thống / Lab Staff',
    avatarBg: '#0058be',
    badgeColor: '#0058be',
    defaultRoute: '/class-setup/admin/semesters',
  },
  LECTURER: {
    email: 'lecturer@smartlabkit.vn',
    password: 'lecturer123',
    name: 'Dr. Evelyn Stone',
    roleLabel: 'LECTURER',
    title: 'Giảng viên phụ trách môn',
    avatarBg: '#0284c7',
    badgeColor: '#0284c7',
    defaultRoute: '/class-setup/lecturer/quotas',
  },
  STUDENT: {
    email: 'student@smartlabkit.vn',
    password: 'student123',
    name: 'Lê Hoàng Nam',
    roleLabel: 'STUDENT',
    title: 'Sinh viên / Nhóm trưởng',
    avatarBg: '#059669',
    badgeColor: '#059669',
    defaultRoute: '/class-setup/student/groups',
  },
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smartlabkit_user')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved user', e)
      }
    }
    // Mặc định đăng nhập vai trò Admin khi khởi chạy
    return DEMO_ACCOUNTS.ADMIN
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem('smartlabkit_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('smartlabkit_user')
    }
  }, [user])

  // Đăng nhập với email & password
  const login = (email, password) => {
    const foundActorKey = Object.keys(DEMO_ACCOUNTS).find(
      (key) => DEMO_ACCOUNTS[key].email.toLowerCase() === email.toLowerCase()
    )

    if (foundActorKey) {
      const actorAccount = DEMO_ACCOUNTS[foundActorKey]
      if (actorAccount.password === password) {
        setUser(actorAccount)
        return { success: true, user: actorAccount }
      }
    }
    // Đăng nhập mặc định linh hoạt nếu gõ bất kỳ email nào
    const roleKey = email.includes('lecturer') || email.includes('teacher') || email.includes('dr') ? 'LECTURER' : email.includes('student') || email.includes('sv') ? 'STUDENT' : 'ADMIN'
    const fallbackUser = {
      ...DEMO_ACCOUNTS[roleKey],
      email: email,
    }
    setUser(fallbackUser)
    return { success: true, user: fallbackUser }
  }

  // Đăng nhập nhanh theo Role Actor
  const loginAsRole = (roleKey) => {
    const actorAccount = DEMO_ACCOUNTS[roleKey] || DEMO_ACCOUNTS.ADMIN
    setUser(actorAccount)
    return actorAccount
  }

  // Đăng xuất
  const logout = () => {
    setUser(null)
    localStorage.removeItem('smartlabkit_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, loginAsRole, logout }}>
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
