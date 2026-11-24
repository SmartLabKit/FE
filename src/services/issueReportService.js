import api, { extractErrorMessage } from './api'

function unwrap(response) {
  return response.data?.data ?? response.data
}

export const issueReportService = {
  /**
   * Tra thiết bị theo mã hoặc serial trước khi ghi nhận sự cố
   * GET /api/issue-reports/lookup?code=
   * Quyền: LabStaff (lab mình phụ trách), InventoryManager (thiết bị trong tủ), Admin
   * Trả về (200): { item, borrowContext (null khi trong tủ), confirmsImmediately, freeReplacementUnits }
   */
  async lookupUnit(code) {
    try {
      return unwrap(await api.get('/api/issue-reports/lookup', { params: { code } }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không tra được thiết bị'), { cause: error })
    }
  },

  /**
   * Ghi nhận một thiết bị REUSABLE / HIGH_VALUE bị hỏng, cháy hoặc mất
   * POST /api/issue-reports
   * Quyền: LabStaff (lab mình phụ trách), Admin: Confirmed ngay; InventoryManager (thiết bị trong tủ): Open
   * Body (multipart/form-data): { componentItemId? | itemCode?, issueType: Damaged | Burnt | Lost, description (tối đa 1000 ký tự),
   *   image (bắt buộc trừ Lost), replace? (đổi con khác cho thiết bị đang mượn) }
   * Trả về (201): IssueReportDetailResponse (kèm replacementBorrowItemId khi có con thay thế)
   */
  async createIssueReport({ itemCode, componentItemId, issueType, description, image, replace }) {
    try {
      const formData = new FormData()
      if (componentItemId) formData.append('componentItemId', componentItemId)
      if (itemCode) formData.append('itemCode', itemCode)
      formData.append('issueType', issueType)
      formData.append('description', description)
      if (image) formData.append('image', image)
      if (replace) formData.append('replace', 'true')
      return unwrap(await api.post('/api/issue-reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể gửi báo cáo sự cố'), { cause: error })
    }
  },

  /**
   * Danh sách báo cáo sự cố theo phạm vi role (Student: đơn mượn của nhóm mình, LabStaff: lab mình, Lecturer: lớp mình)
   * GET /api/issue-reports
   * Query: { status?, issueType?, roomId?, componentId?, componentItemId?, itemCode?, reportedBy?, fromDate?, toDate?, mine?, page?, size? }
   * Trả về (200): PagedResult<IssueReportListItemResponse>
   */
  async getIssueReports(params = { page: 1, size: 20 }) {
    try {
      return unwrap(await api.get('/api/issue-reports', { params }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách sự cố'), { cause: error })
    }
  },

  /**
   * Chi tiết một báo cáo sự cố
   * GET /api/issue-reports/{id}
   * Trả về (200): IssueReportDetailResponse (kèm thông tin thiết bị và đơn mượn liên quan)
   */
  async getIssueReport(id) {
    try {
      return unwrap(await api.get(`/api/issue-reports/${id}`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết sự cố'), { cause: error })
    }
  },

  /**
   * LabStaff đúng lab hoặc Admin xác nhận / từ chối báo cáo đang Open
   * POST /api/issue-reports/{id}/resolve
   * Body: { result: Confirmed | Rejected, note? }
   * Trả về (200): IssueReportDetailResponse
   */
  async resolveIssueReport(id, { result, note }) {
    try {
      return unwrap(await api.post(`/api/issue-reports/${id}/resolve`, { result, note: note?.trim() || null }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể xử lý báo cáo sự cố'), { cause: error })
    }
  },

  /**
   * Người tạo báo cáo hoặc Admin hủy báo cáo khi còn Open
   * POST /api/issue-reports/{id}/cancel
   * Trả về (200): IssueReportDetailResponse
   */
  async cancelIssueReport(id) {
    try {
      return unwrap(
        await api.post(`/api/issue-reports/${id}/cancel`, {}, {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể hủy báo cáo sự cố'), { cause: error })
    }
  },
}
