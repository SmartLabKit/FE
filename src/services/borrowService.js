import api, { extractErrorMessage } from './api'

// Hằng số rỗng tương thích ngược cho các màn hình mượn trả (không chứa mock data)
export const MOCK_SUPPLEMENTARY_REQUESTS = []
export const MOCK_AVAILABLE_COMPONENTS = []
export const MOCK_ORIGINAL_BORROWS = []
export const MOCK_RETURN_REQUESTS = []
export const MOCK_BORROW_EXTENSIONS = []
export const MOCK_BORROW_TRANSFERS = []

export const borrowService = {
  // ===================== 1. ĐƠN MƯỢN CỦA TÔI & CHI TIẾT ĐƠN =====================

  /**
   * Đơn mượn của tôi: đơn mình gửi và đơn của nhóm mình. Mới nhất lên trước.
   * GET /api/borrow-requests/my
   * Quyền: Đăng nhập
   * Query: Search (string), Status (string), Overdue (bool), Page (int), Size (int)
   * Trả về (200): PagedResult
   */
  async getMyBorrowRequests(params = {}) {
    try {
      const response = await api.get('/api/borrow-requests/my', { params })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách đơn mượn của bạn'), { cause: error })
    }
  },

  /**
   * Danh sách đơn cho nhân viên lab: đơn có lab nhận đồ hoặc lab chuyển hàng là lab mình phụ trách (Admin thấy tất cả).
   * GET /api/borrow-requests
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Query: Search (string), Status (string), Overdue (bool), Page (int), Size (int)
   * Trả về (200): PagedResult
   * Lỗi có thể gặp: 403
   */
  async getLabBorrowRequests(params = {}) {
    try {
      const response = await api.get('/api/borrow-requests', { params })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Bạn không có quyền xem danh sách đơn Lab (Yêu cầu LabStaff hoặc Admin).', { cause: error })
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách đơn mượn Lab'), { cause: error })
    }
  },

  /**
   * Chi tiết đơn: các dòng linh kiện, ảnh giao/trả, lịch sử duyệt
   * GET /api/borrow-requests/{id}
   * Quyền: Đăng nhập
   * Path: id (guid)
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 403, 404
   */
  async getBorrowRequestById(id) {
    try {
      const response = await api.get(`/api/borrow-requests/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết đơn mượn'), { cause: error })
    }
  },

  // ===================== 2. GIA HẠN ĐƠN MƯỢN (EXTENSIONS) =====================

  /**
   * Nhóm trưởng xin gia hạn đơn đang mượn, phải xin trước khi quá hạn
   * POST /api/borrow-requests/{id}/extensions
   * Quyền: BORROW_CREATE (Admin, Student)
   * Path: id (guid)
   * Body (JSON): RequestExtensionRequest { requestedDays: int, reason: string }
   * Trả về (201): BorrowExtensionResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async requestExtension(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/extensions`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xin gia hạn đơn thất bại'), { cause: error })
    }
  },

  /**
   * Danh sách yêu cầu gia hạn cho giảng viên (Admin thấy tất cả)
   * GET /api/borrow-extensions
   * Quyền: BORROW_APPROVE (Admin, LabStaff, Lecturer)
   * Query: Search (string), Status (string), Page (int), Size (int)
   * Trả về (200): PagedResult
   */
  async getBorrowExtensions(params = {}) {
    try {
      const response = await api.get('/api/borrow-extensions', { params })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách yêu cầu gia hạn'), { cause: error })
    }
  },

  /**
   * Giảng viên duyệt gia hạn: hạn trả của đơn đổi sang ngày mới
   * POST /api/borrow-extensions/{extensionId}/approve
   * Quyền: BORROW_APPROVE (Admin, LabStaff, Lecturer)
   * Path: extensionId (guid)
   * Body (JSON): ApproveExtensionRequest { comment?: string }
   * Trả về (200): BorrowExtensionResponse
   * Lỗi có thể gặp: 403, 404, 409
   */
  async approveExtension(extensionId, data = {}) {
    try {
      const response = await api.post(`/api/borrow-extensions/${extensionId}/approve`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Duyệt gia hạn thất bại'), { cause: error })
    }
  },

  /**
   * Giảng viên từ chối gia hạn, bắt buộc ghi lý do (gửi mail cho sinh viên)
   * POST /api/borrow-extensions/{extensionId}/reject
   * Quyền: BORROW_APPROVE (Admin, LabStaff, Lecturer)
   * Path: extensionId (guid)
   * Body (JSON): RejectExtensionRequest { reason: string }
   * Trả về (200): BorrowExtensionResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async rejectExtension(extensionId, data) {
    try {
      const response = await api.post(`/api/borrow-extensions/${extensionId}/reject`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Từ chối gia hạn thất bại'), { cause: error })
    }
  },

  // ===================== 3. ĐIỀU CHUYỂN, BÀN GIAO & ẢNH AI (TRANSFERS, ISSUE, PHOTOS) =====================

  /**
   * Các dòng linh kiện đang chờ mang từ lab khác về lab nhận đồ
   * GET /api/borrow-requests/transfers
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Query: SourceRoomId (guid), Search (string), Page (int), Size (int)
   * Trả về (200): PagedResult
   * Lỗi có thể gặp: 403
   */
  async getBorrowTransfers(params = {}) {
    try {
      const response = await api.get('/api/borrow-requests/transfers', { params })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Bạn không có quyền truy cập luồng chuyển hàng (Yêu cầu LabStaff hoặc Admin).', { cause: error })
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách chuyển hàng'), { cause: error })
    }
  },

  /**
   * Nhân viên lab nhận đồ xác nhận đã nhận 1 dòng mang từ lab khác về
   * POST /api/borrow-requests/{id}/receive
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): ReceiveTransferRequest
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async receiveTransfer(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/receive`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xác nhận nhận linh kiện chuyển lab thất bại'), { cause: error })
    }
  },

  /**
   * Tải ảnh giao đồ (photoType = Issue) hoặc ảnh nhận trả (Return): AI đọc MSSV trên thẻ sinh viên
   * POST /api/borrow-requests/{id}/photos
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (form): File (file), PhotoType (string: 'Issue' | 'Return')
   * Trả về (201): HandoverPhotoResponse { photoUrl, aiResult: 'Match' | 'Mismatch' | 'Unreadable', detectedStudentCode }
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async uploadHandoverPhoto(id, file, photoType = 'Issue') {
    try {
      const formData = new FormData()
      formData.append('File', file)
      formData.append('PhotoType', photoType)

      const response = await api.post(`/api/borrow-requests/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tải ảnh bàn giao thất bại'), { cause: error })
    }
  },

  /**
   * Giao đồ cho sinh viên (Ready → Borrowing)
   * POST /api/borrow-requests/{id}/issue
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): IssueBorrowRequest
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async issueBorrowRequest(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/issue`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Bàn giao linh kiện thất bại'), { cause: error })
    }
  },

  /**
   * Nhận trả tại lab nhận đồ (trả được nhiều lần)
   * POST /api/borrow-requests/{id}/return
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): ReturnBorrowRequest
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async returnBorrowRequest(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/return`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tiếp nhận trả linh kiện thất bại'), { cause: error })
    }
  },

  // ===================== 4. LINH KIỆN THAY THẾ & HỦY ĐƠN (REPLACEMENTS & CANCEL) =====================

  /**
   * Đổi 1 con bị hỏng trong lúc mượn (đơn đang mượn), loại khỏi kho & thêm dòng món thay thế
   * POST /api/borrow-requests/{id}/replace-damaged
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): ReplaceDamagedRequest
   * Trả về (200): ReplaceDamagedResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async replaceDamagedComponent(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/replace-damaged`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Ghi nhận linh kiện hỏng thất bại'), { cause: error })
    }
  },

  /**
   * Giao món thay thế đã về lab nhận đồ cho sinh viên
   * POST /api/borrow-requests/{id}/replacements/issue
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): IssueReplacementRequest
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async issueReplacement(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/replacements/issue`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Giao món thay thế thất bại'), { cause: error })
    }
  },

  /**
   * Hủy món thay thế chưa giao (ghi rõ lý do để gửi mail)
   * POST /api/borrow-requests/{id}/replacements/cancel
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): CancelReplacementRequest { reason: string }
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async cancelReplacement(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/replacements/cancel`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Hủy món thay thế thất bại'), { cause: error })
    }
  },

  /**
   * Hủy đơn đã duyệt mà chưa giao đồ (Approved / Ready)
   * POST /api/borrow-requests/{id}/cancel
   * Quyền: Đăng nhập
   * Path: id (guid)
   * Body (JSON): CancelBorrowRequest { reason: string }
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async cancelBorrowRequest(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/cancel`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Hủy đơn mượn thất bại'), { cause: error })
    }
  },

  // ===================== 5. MƯỢN BỔ SUNG (MF5.1) & TRẢ LINH KIỆN (MF5.2) =====================

  async getAvailableComponents(search = '') {
    try {
      const response = await api.get('/api/components', { params: { search, isAvailable: true } })
      return response.data?.data?.items || response.data?.items || response.data || []
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách linh kiện'), { cause: error })
    }
  },

  async createSupplementaryBorrow(projectId, data) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tạo đơn mượn bổ sung thất bại'), { cause: error })
    }
  },

  async getSupplementaryBorrowById(id) {
    try {
      const response = await api.get(`/api/projects/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết đơn mượn'), { cause: error })
    }
  },

  async withdrawSupplementaryBorrow(projectId) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow/withdraw`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Thu hồi đơn mượn thất bại'), { cause: error })
    }
  },

  async getPendingApprovalProjects() {
    try {
      const response = await api.get('/api/projects/pending-approval')
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách đơn chờ duyệt'), { cause: error })
    }
  },

  async approveSupplementaryBorrow(projectId, comment = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/approve`, { comment })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Duyệt đơn thất bại'), { cause: error })
    }
  },

  async rejectSupplementaryBorrow(projectId, reason = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/reject`, { reason })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Từ chối đơn thất bại'), { cause: error })
    }
  },

  async getReturnRequests() {
    try {
      const response = await api.get('/api/borrow-requests', { params: { status: 'Returned' } })
      return response.data?.data?.items || response.data?.items || response.data || []
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách phiếu trả'), { cause: error })
    }
  },

  async getReturnRequestById(id) {
    try {
      const response = await api.get(`/api/borrow-requests/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết phiếu trả'), { cause: error })
    }
  },

  async createReturnRequest(data) {
    try {
      const response = await api.post(`/api/borrow-requests/${data.borrowRequestId}/return`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tạo phiếu trả linh kiện thất bại'), { cause: error })
    }
  },

  async confirmReturnRequest(id, data = {}) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/return`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xác nhận trả linh kiện thất bại'), { cause: error })
    }
  },
}

export default borrowService
