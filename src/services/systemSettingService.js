import api, { extractErrorMessage } from './api'

export const systemSettingService = {
  /**
   * Lấy danh sách toàn bộ cài đặt hệ thống Admin được sửa
   * GET /api/system-settings
   * Quyền: Chỉ role Admin
   * Trả về (200): SystemSettingResponse[]
   */
  async getSystemSettings() {
    try {
      const response = await api.get('/api/system-settings')
      const backendData = response.data?.data || response.data
      return Array.isArray(backendData) ? backendData : []
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Bạn không có quyền truy cập cài đặt hệ thống (Yêu cầu vai trò Admin).', { cause: error })
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải cài đặt hệ thống'), { cause: error })
    }
  },

  /**
   * Cập nhật một cài đặt hệ thống theo key
   * PUT /api/system-settings/{key}
   * Quyền: Chỉ role Admin
   * Path: key (string)
   * Body (JSON): UpdateSystemSettingRequest { value: string, description?: string }
   * Trả về (200): SystemSettingResponse
   */
  async updateSystemSetting(key, data) {
    try {
      const payload = {
        value: String(data.value),
        ...(data.description ? { description: data.description } : {}),
      }
      const response = await api.put(`/api/system-settings/${key}`, payload)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Bạn không có quyền sửa cài đặt hệ thống (Yêu cầu vai trò Admin).', { cause: error })
      }
      if (error.response?.status === 404) {
        throw new Error(`Cài đặt hệ thống có mã "${key}" không tồn tại trên hệ thống.`, { cause: error })
      }
      if (error.response?.status === 409) {
        throw new Error('Xung đột dữ liệu khi cập nhật cài đặt. Vui lòng tải lại trang.', { cause: error })
      }
      throw new Error(extractErrorMessage(error, `Không thể cập nhật cài đặt "${key}"`), { cause: error })
    }
  },
}
