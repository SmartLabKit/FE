import api, { extractErrorMessage } from './api'

/**
 * Mock data cài đặt hệ thống (System Settings) ban đầu
 * Hỗ trợ fallback khi kết nối Backend gặp sự cố hoặc chưa seed data
 */
export const MOCK_SYSTEM_SETTINGS = [
  {
    key: 'PICKUP_ROOM_ID',
    name: 'Phòng/Lab nhận và trả linh kiện',
    value: 'B1-302 · Phòng thực hành IoT',
    unit: '',
    group: 'BORROW_RETURN',
    description: 'Địa điểm mặc định để sinh viên đến nhận linh kiện đã mượn và hoàn trả cho Lab.',
    dataType: 'string',
    updatedAt: '2026-10-25T10:00:00.000Z',
    updatedBy: 'Admin',
  },
  {
    key: 'BORROW_MAX_DAYS',
    name: 'Số ngày mượn tối đa',
    value: '14',
    unit: 'ngày',
    group: 'BORROW_RETURN',
    description: 'Thời gian mượn tối đa cho một đơn mượn linh kiện thực hành (tính từ ngày Lab bàn giao).',
    dataType: 'number',
    min: 1,
    max: 60,
    updatedAt: '2026-10-25T10:00:00.000Z',
    updatedBy: 'Admin',
  },
  {
    key: 'MAX_EXTENSIONS',
    name: 'Số lần gia hạn tối đa',
    value: '2',
    unit: 'lần',
    group: 'BORROW_RETURN',
    description: 'Số lần tối đa nhóm sinh viên được phép gửi yêu cầu gia hạn thời gian mượn cho một đơn.',
    dataType: 'number',
    min: 0,
    max: 5,
    updatedAt: '2026-10-25T10:00:00.000Z',
    updatedBy: 'Admin',
  },
  {
    key: 'REMINDER_HOURS',
    name: 'Giờ gửi thông báo nhắc hạn',
    value: '24',
    unit: 'giờ trước hạn',
    group: 'NOTIFICATION',
    description: 'Khoảng thời gian hệ thống tự động gửi email và thông báo nhắc nhở sinh viên sắp đến hạn trả linh kiện.',
    dataType: 'number',
    min: 1,
    max: 72,
    updatedAt: '2026-10-25T10:00:00.000Z',
    updatedBy: 'Admin',
  },
  {
    key: 'MAX_ITEMS_PER_BORROW',
    name: 'Số loại linh kiện tối đa mỗi đơn',
    value: '10',
    unit: 'loại',
    group: 'BORROW_RETURN',
    description: 'Giới hạn số loại linh kiện khác nhau mà một nhóm sinh viên có thể đăng ký trong một đơn mượn.',
    dataType: 'number',
    min: 1,
    max: 30,
    updatedAt: '2026-10-25T10:00:00.000Z',
    updatedBy: 'Admin',
  },
  {
    key: 'AUTO_CANCEL_HOURS',
    name: 'Thời gian tự hủy đơn chưa nhận',
    value: '48',
    unit: 'giờ',
    group: 'BORROW_RETURN',
    description: 'Thời gian chờ tối đa kể từ khi Lab chuẩn bị xong đồ nhưng sinh viên chưa đến nhận trước khi tự động hủy đơn.',
    dataType: 'number',
    min: 12,
    max: 120,
    updatedAt: '2026-10-25T10:00:00.000Z',
    updatedBy: 'Admin',
  },
]

let localSettings = JSON.parse(JSON.stringify(MOCK_SYSTEM_SETTINGS))

export const systemSettingService = {
  /**
   * Lấy danh sách toàn bộ cài đặt hệ thống
   * GET /api/system-settings
   * Quyền: Chỉ role Admin
   * Trả về (200): SystemSettingResponse[]
   * Lỗi có thể gặp: 403
   */
  async getSystemSettings() {
    try {
      const response = await api.get('/api/system-settings')
      const data = response.data?.data || response.data
      if (Array.isArray(data) && data.length > 0) {
        // Hợp nhất dữ liệu trả về từ backend với thông tin mô tả chi tiết nếu backend chỉ trả key-value
        return data.map((item) => {
          const matched = localSettings.find((m) => m.key === item.key)
          return {
            ...matched,
            ...item,
            name: matched?.name || item.name || item.key,
            description: item.description || matched?.description || '',
            unit: matched?.unit || item.unit || '',
            dataType: matched?.dataType || item.dataType || 'string',
            group: matched?.group || item.group || 'GENERAL',
          }
        })
      }
      return localSettings
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Bạn không có quyền truy cập cài đặt hệ thống (Yêu cầu vai trò Admin).', { cause: error })
      }
      if (error.response?.status === 500 || error.response?.status === 404 || !error.response) {
        console.warn('API /api/system-settings lỗi, sử dụng mock fallback')
        return localSettings
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải cài đặt hệ thống'), { cause: error })
    }
  },

  /**
   * Cập nhật một cài đặt hệ thống theo key
   * PUT /api/system-settings/{key}
   * Sửa một cài đặt theo key, ví dụ PICKUP_ROOM_ID hoặc BORROW_MAX_DAYS
   * Quyền: Chỉ role Admin
   * Path: key (string)
   * Body (JSON): UpdateSystemSettingRequest { value: string, description?: string }
   * Trả về (200): SystemSettingResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async updateSystemSetting(key, data) {
    try {
      const payload = {
        value: String(data.value),
        ...(data.description ? { description: data.description } : {}),
      }
      const response = await api.put(`/api/system-settings/${key}`, payload)
      const updated = response.data?.data || response.data

      // Cập nhật local fallback
      const idx = localSettings.findIndex((s) => s.key === key)
      if (idx !== -1) {
        localSettings[idx] = {
          ...localSettings[idx],
          ...updated,
          value: String(data.value),
          description: data.description || localSettings[idx].description,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Admin',
        }
      }

      return updated || localSettings[idx]
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
      if (error.response?.status === 500 || !error.response) {
        console.warn(`API /api/system-settings/${key} (PUT) lỗi, cập nhật mock fallback`)
        const idx = localSettings.findIndex((s) => s.key === key)
        if (idx !== -1) {
          localSettings[idx] = {
            ...localSettings[idx],
            value: String(data.value),
            description: data.description || localSettings[idx].description,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Admin',
          }
          return localSettings[idx]
        }
      }
      throw new Error(extractErrorMessage(error, `Không thể cập nhật cài đặt "${key}"`), { cause: error })
    }
  },
}

export default systemSettingService
