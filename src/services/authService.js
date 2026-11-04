import api, { extractErrorMessage } from './api'

/**
 * authService: Tích hợp toàn bộ API Xác thực & Người dùng hiện tại
 * Kết nối 100% trực tiếp Backend API SmartLabKit (không sử dụng mock).
 */
export const authService = {
  /**
   * Đăng nhập bằng email hoặc username
   * POST /api/auth/login
   * Body: LoginRequest { identifier, password }
   * Trả về (200): AuthResponse { accessToken, tokenType, user: CurrentUserDto }
   */
  async login(data) {
    try {
      const response = await api.post('/api/auth/login', {
        identifier: data.identifier?.trim(),
        password: data.password,
      })

      const result = response.data?.data || response.data
      if (result?.accessToken) {
        localStorage.setItem('smartlabkit_token', result.accessToken)
      }
      return result
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Đăng nhập không thành công'), { cause: error })
    }
  },

  /**
   * Đăng xuất người dùng hiện tại
   * POST /api/auth/logout
   * Quyền: Đăng nhập
   * Trả về (200): ApiResponse
   */
  async logout() {
    try {
      const response = await api.post('/api/auth/logout')
      return response.data
    } catch (error) {
      console.warn('API /api/auth/logout kết thúc phiên:', error.message)
      return { success: true }
    } finally {
      localStorage.removeItem('smartlabkit_token')
      localStorage.removeItem('smartlabkit_user')
    }
  },

  /**
   * Lấy thông tin người dùng hiện tại + roles + permissions
   * GET /api/auth/me
   * Quyền: Đăng nhập
   * Trả về (200): CurrentUserDto
   */
  async getMe() {
    try {
      const response = await api.get('/api/auth/me')
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải thông tin tài khoản hiện tại'), { cause: error })
    }
  },

  /**
   * Cập nhật thông tin cá nhân của người dùng hiện tại
   * PUT /api/auth/me
   * Body: UpdateProfileRequest { fullName, phoneNumber, avatarUrl }
   * Trả về (200): CurrentUserDto
   */
  async updateProfile(data) {
    try {
      const response = await api.put('/api/auth/me', data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Cập nhật thông tin không thành công'), { cause: error })
    }
  },

  /**
   * Đổi mật khẩu của người dùng hiện tại
   * PUT /api/auth/me/password
   * Body: ChangePasswordRequest { currentPassword, newPassword }
   * Trả về (200): ApiResponse<AuthResponse>
   */
  async changePassword(data) {
    try {
      const response = await api.put('/api/auth/me/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })

      const result = response.data?.data || response.data
      if (result?.accessToken) {
        localStorage.setItem('smartlabkit_token', result.accessToken)
      }
      return result
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Đổi mật khẩu không thành công'), { cause: error })
    }
  },

  /**
   * Gửi mã đặt lại mật khẩu tới email
   * POST /api/auth/forgot-password
   * Body: ForgotPasswordRequest { email }
   * Trả về (200): không có data
   */
  async forgotPassword(data) {
    try {
      const response = await api.post('/api/auth/forgot-password', data)
      return response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể gửi yêu cầu đặt lại mật khẩu'), { cause: error })
    }
  },

  /**
   * Đặt lại mật khẩu bằng mã đã gửi tới email
   * POST /api/auth/reset-password
   * Body: ResetPasswordRequest { email, code, newPassword }
   * Trả về (200): không có data
   */
  async resetPassword(data) {
    try {
      const response = await api.post('/api/auth/reset-password', data)
      return response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Đặt lại mật khẩu thất bại'), { cause: error })
    }
  },
}
