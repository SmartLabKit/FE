import api, { extractErrorMessage } from './api'

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
      throw new Error(extractErrorMessage(error, 'Gán vai trò không thành công'), { cause: error })
    }
  },

  /**
   * Cập nhật thông tin người dùng
   * PUT /api/users/{id}
   * Quyền: USER_MANAGE (Admin)
   * Body: UpdateUserRequest { fullName, phoneNumber, isActive }
   * Trả về (200): UserDetailResponse
   */
  async updateUser(id, data) {
    try {
      const response = await api.put(`/api/users/${id}`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Cập nhật người dùng thất bại'), { cause: error })
    }
  },

  /**
   * Đặt lại mật khẩu người dùng (trả về mật khẩu tạm một lần duy nhất)
   * POST /api/users/{id}/reset-password
   * Quyền: USER_MANAGE (Admin)
   * Trả về (200): ResetPasswordResponse { temporaryPassword }
   */
  async resetPassword(id) {
    try {
      const response = await api.post(`/api/users/${id}/reset-password`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Đặt lại mật khẩu thất bại'), { cause: error })
    }
  },
}
