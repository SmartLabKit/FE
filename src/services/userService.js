import api, { extractErrorMessage } from './api'
import { MOCK_USERS } from './mockData'

// Bộ nhớ đệm cục bộ cho mock users khi DB chưa kết nối
let localMockUsers = [...MOCK_USERS]

export const userService = {
  /**
   * Lấy danh sách người dùng (phân trang, tìm kiếm, lọc theo role/trạng thái)
   * GET /api/users
   * Query: search, role, isActive, page, size
   * Trả về (200): PagedResult
   */
  async getUsers({ search = '', role = '', isActive, page = 1, size = 10 } = {}) {
    try {
      const params = {}
      if (search) params.Search = search
      if (role) params.Role = role
      if (isActive !== undefined && isActive !== '') params.IsActive = isActive
      if (page) params.Page = page
      if (size) params.Size = size

      const response = await api.get('/api/users', { params })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || !error.response) {
        console.warn('API /api/users gặp lỗi server, sử dụng mock fallback')

        // Lọc mock users
        let filtered = [...localMockUsers]

        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(
            (u) =>
              u.fullName.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q) ||
              u.username.toLowerCase().includes(q)
          )
        }

        if (role) {
          filtered = filtered.filter((u) => u.roles && u.roles.includes(role))
        }

        if (isActive !== undefined && isActive !== '') {
          const activeBool = isActive === true || isActive === 'true'
          filtered = filtered.filter((u) => u.isActive === activeBool)
        }

        const totalItems = filtered.length
        const totalPages = Math.ceil(totalItems / size) || 1
        const startIndex = (page - 1) * size
        const items = filtered.slice(startIndex, startIndex + size)

        return {
          items,
          totalItems,
          page,
          size,
          totalPages,
          hasPreviousPage: page > 1,
          hasNextPage: page < totalPages,
        }
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách người dùng'), { cause: error })
    }
  },

  /**
   * Lấy thông tin chi tiết người dùng
   * GET /api/users/{id}
   * Quyền: USER_MANAGE (Admin)
   * Trả về (200): UserDetailResponse
   */
  async getUserById(id) {
    try {
      const response = await api.get(`/api/users/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 404 || !error.response) {
        console.warn(`API /api/users/${id} gặp lỗi, tìm kiếm trong mock users`)
        const user = localMockUsers.find((u) => u.userId === id)
        if (user) {
          return {
            ...user,
            updatedAt: '2026-10-27T18:00:00Z',
          }
        }
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết người dùng'), { cause: error })
    }
  },

  /**
   * Tạo tài khoản mới (LabStaff, InventoryManager, Lecturer)
   * POST /api/users
   * Quyền: USER_MANAGE (Admin)
   * Body: CreateUserRequest { username, email, password, fullName, phoneNumber, role, instructorCode, academicTitle }
   * Trả về (201): UserDetailResponse
   */
  async createUser(data) {
    try {
      const response = await api.post('/api/users', data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || !error.response) {
        console.warn('API /api/users (POST) gặp lỗi server, thêm mới vào mock storage')
        const newUser = {
          userId: `u-${Date.now()}`,
          username: data.username,
          email: data.email,
          fullName: data.fullName,
          phoneNumber: data.phoneNumber || '',
          avatarUrl: '',
          isActive: true,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          roles: [data.role],
          instructorProfile:
            data.role === 'Lecturer'
              ? {
                  instructorCode: data.instructorCode || `INS${Math.floor(100 + Math.random() * 900)}`,
                  academicTitle: data.academicTitle || 'Giảng viên',
                }
              : null,
        }
        localMockUsers.unshift(newUser)
        return newUser
      }
      throw new Error(extractErrorMessage(error, 'Tạo tài khoản không thành công'), { cause: error })
    }
  },

  /**
   * Gán vai trò cho người dùng (thay thế toàn bộ vai trò hiện tại)
   * PUT /api/users/{id}/roles
   * Quyền: USER_MANAGE (Admin)
   * Body: AssignRolesRequest { roles: string[] }
   * Trả về (200): UserDetailResponse
   */
  async assignRoles(id, roles) {
    try {
      const response = await api.put(`/api/users/${id}/roles`, { roles })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || !error.response) {
        console.warn(`API /api/users/${id}/roles gặp lỗi, cập nhật trong mock users`)
        const userIndex = localMockUsers.findIndex((u) => u.userId === id)
        if (userIndex !== -1) {
          localMockUsers[userIndex] = {
            ...localMockUsers[userIndex],
            roles: roles,
            updatedAt: new Date().toISOString(),
          }
          return localMockUsers[userIndex]
        }
      }
      throw new Error(extractErrorMessage(error, 'Gán vai trò không thành công'), { cause: error })
    }
  },
}
