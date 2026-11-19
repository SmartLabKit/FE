import api, { extractErrorMessage } from './api'

export const auditLogService = {
  /**
   * Nhật ký thao tác (mới nhất trước, phân trang)
   * GET /api/audit-logs
   * Quyền: AUDITLOG_VIEW (Admin)
   * Lọc: userId, action (LOGIN, CHANGE_PASSWORD...), entityName (User, Role, SystemSetting),
   * isSuccess, fromDate / toDate (ngày lịch Việt Nam yyyy-MM-dd, tính cả 2 đầu)
   * Trả về (200): PagedResult<AuditLogResponse> { items, pageNumber, pageSize, totalCount }
   */
  async getAuditLogs({ userId, action, entityName, isSuccess, fromDate, toDate, page = 1, size = 20 } = {}) {
    try {
      const params = { page, size }
      if (userId) params.userId = userId
      if (action) params.action = action
      if (entityName) params.entityName = entityName
      if (isSuccess !== undefined && isSuccess !== '') params.isSuccess = isSuccess
      if (fromDate) params.fromDate = fromDate
      if (toDate) params.toDate = toDate

      const response = await api.get('/api/audit-logs', { params })
      return response.data?.data ?? response.data
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Bạn không có quyền xem nhật ký thao tác.', { cause: error })
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải nhật ký thao tác'), { cause: error })
    }
  },
}
