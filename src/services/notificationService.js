import api, { extractErrorMessage } from './api'

function unwrap(response) {
  return response.data?.data ?? response.data
}

export const notificationService = {
  /**
   * Thông báo của người đang đăng nhập (mới nhất trước)
   * GET /api/notifications/my
   * Quyền: Đăng nhập
   * Query: { isRead?: boolean, page?, size? }
   * Trả về (200): PagedResult<NotificationResponse { notificationId, title, refType, refId, isRead, createdAt, readAt }>
   */
  async getMyNotifications(params = { page: 1, size: 10 }) {
    try {
      return unwrap(await api.get('/api/notifications/my', { params }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách thông báo'), { cause: error })
    }
  },

  /**
   * Số thông báo chưa đọc (hiện trên biểu tượng chuông)
   * GET /api/notifications/unread-count
   * Trả về (200): UnreadCountResponse { unreadCount }
   */
  async getUnreadCount() {
    try {
      const result = unwrap(await api.get('/api/notifications/unread-count'))
      return Number(result?.unreadCount || 0)
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải số thông báo chưa đọc'), { cause: error })
    }
  },

  /**
   * Đánh dấu một thông báo đã đọc (khi bấm vào thông báo)
   * POST /api/notifications/{id}/read
   * Trả về (200): NotificationResponse
   */
  async markAsRead(id) {
    try {
      return unwrap(await api.post(`/api/notifications/${id}/read`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể đánh dấu thông báo đã đọc'), { cause: error })
    }
  },

  /**
   * Đánh dấu tất cả thông báo đã đọc
   * POST /api/notifications/read-all
   * Trả về (200): UnreadCountResponse { unreadCount }
   */
  async markAllAsRead() {
    try {
      const result = unwrap(await api.post('/api/notifications/read-all'))
      return Number(result?.unreadCount || 0)
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể đánh dấu tất cả đã đọc'), { cause: error })
    }
  },
}
