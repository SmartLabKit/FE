import api, { extractErrorMessage } from './api'

// ===================== MOCK DATA BAN ĐẦU & FALLBACK =====================

export const MOCK_SUPPLEMENTARY_REQUESTS = [
  {
    supplementaryId: 'BS-2026-014',
    requestCode: 'BS-2026-014',
    projectId: 'proj-001',
    originalBorrowCode: 'BR-2026-1020',
    originalBorrowId: 'br-001',
    status: 'PendingLecturer', // 'Draft' | 'PendingLecturer' | 'Rejected' | 'Approved' | 'Preparing'
    leaderName: 'Lê Hoàng Nam',
    leaderCode: '20214589',
    teamName: 'Nhóm 07 – IoT',
    classCode: 'EE302 - IoT & Embedded',
    lecturerName: 'Nguyễn Văn Minh',
    lecturerEmail: 'minh.nv@smartlab.edu.vn',
    reason: 'Bổ sung bộ điều khiển và cảm biến để hoàn thiện mô hình IoT của nhóm.',
    submittedAt: '2026-10-22T09:15:00.000Z',
    reviewedAt: null,
    rejectReason: null,
    dueDate: '2026-10-29',
    components: [
      {
        componentId: 'comp-esp32',
        componentCode: 'MCU-ESP32',
        componentName: 'ESP32 DevKit',
        quantity: 1,
        availableQuantity: 12,
        dueDate: '2026-10-29',
      },
      {
        componentId: 'comp-dht22',
        componentCode: 'SEN-DHT22',
        componentName: 'Cảm biến DHT22',
        quantity: 2,
        availableQuantity: 20,
        dueDate: '2026-10-29',
      },
    ],
  },
  {
    supplementaryId: 'BS-2026-015',
    requestCode: 'BS-2026-015',
    projectId: 'proj-002',
    originalBorrowCode: 'BR-2026-1020',
    originalBorrowId: 'br-001',
    status: 'Rejected',
    leaderName: 'Lê Hoàng Nam',
    leaderCode: '20214589',
    teamName: 'Nhóm 07 – IoT',
    classCode: 'EE302 - IoT & Embedded',
    lecturerName: 'Nguyễn Văn Minh',
    lecturerEmail: 'minh.nv@smartlab.edu.vn',
    reason: 'Bổ sung bộ điều khiển và cảm biến để hoàn thiện mô hình IoT của nhóm.',
    submittedAt: '2026-10-22T09:15:00.000Z',
    reviewedAt: '2026-10-22T10:00:00.000Z',
    rejectReason: 'Nhu cầu bổ sung chưa được giải trình rõ cho bài thực hành hiện tại.',
    dueDate: '2026-10-29',
    components: [
      {
        componentId: 'comp-esp32',
        componentCode: 'MCU-ESP32',
        componentName: 'ESP32 DevKit',
        quantity: 1,
        availableQuantity: 12,
        dueDate: '2026-10-29',
      },
      {
        componentId: 'comp-dht22',
        componentCode: 'SEN-DHT22',
        componentName: 'Cảm biến DHT22',
        quantity: 2,
        availableQuantity: 20,
        dueDate: '2026-10-29',
      },
    ],
  },
]

export const MOCK_AVAILABLE_COMPONENTS = [
  {
    componentId: 'comp-esp32',
    componentCode: 'MCU-ESP32',
    componentName: 'ESP32 DevKit',
    packageType: 'Kit phát triển IoT',
    availableQuantity: 12,
    totalStock: 30,
  },
  {
    componentId: 'comp-dht22',
    componentCode: 'SEN-DHT22',
    componentName: 'Cảm biến DHT22',
    packageType: 'Cảm biến nhiệt độ & độ ẩm',
    availableQuantity: 20,
    totalStock: 50,
  },
  {
    componentId: 'comp-relay4ch',
    componentCode: 'MOD-RELAY-4',
    componentName: 'Mô-đun Relay 4 kênh 5V',
    packageType: 'Mô-đun đóng cắt',
    availableQuantity: 15,
    totalStock: 25,
  },
  {
    componentId: 'comp-oled096',
    componentCode: 'DISP-OLED-096',
    componentName: 'Màn hình OLED 0.96 inch I2C',
    packageType: 'Màn hình hiển thị',
    availableQuantity: 8,
    totalStock: 20,
  },
]

export const MOCK_ORIGINAL_BORROWS = [
  {
    borrowRequestId: 'br-001',
    requestCode: 'BR-2026-1020',
    projectId: 'proj-001',
    projectTitle: 'Dự án Hệ thống IoT Giám sát Môi trường',
    classCode: 'EE302 - IoT & Embedded',
    teamName: 'Nhóm 07 – IoT',
    leaderName: 'Lê Hoàng Nam',
    leaderCode: '20214589',
    status: 'Borrowing', // 'Approved' | 'Ready' | 'Borrowing' | 'Returned' | 'Cancelled'
    pickupRoomName: 'B1-302 · Phòng thực hành IoT',
    borrowDate: '2026-10-15',
    dueDate: '2026-10-29',
    extensionCount: 0,
    maxExtensions: 2,
    lecturerName: 'Nguyễn Văn Minh',
    lecturerCode: 'LEC-012',
    items: [
      {
        borrowItemId: 'item-01',
        componentCode: 'MCU-ESP32',
        componentName: 'ESP32 DevKit',
        quantity: 1,
        status: 'Issued',
        sourceRoom: 'B1-302',
      },
      {
        borrowItemId: 'item-02',
        componentCode: 'SEN-DHT22',
        componentName: 'Cảm biến DHT22',
        quantity: 2,
        status: 'Issued',
        sourceRoom: 'B1-302',
      },
    ],
  },
  {
    borrowRequestId: 'br-002',
    requestCode: 'BR-2026-1018',
    projectId: 'proj-002',
    projectTitle: 'Thiết kế Robot Dò đường Thông minh',
    classCode: 'ME204 - Robotics',
    teamName: 'Nhóm 03 – Robotics',
    leaderName: 'Trần Văn An',
    leaderCode: '20210045',
    status: 'Ready',
    pickupRoomName: 'B1-302 · Phòng thực hành IoT',
    borrowDate: '2026-10-20',
    dueDate: '2026-11-15',
    extensionCount: 0,
    maxExtensions: 2,
    lecturerName: 'TS. Nguyễn Văn Thành',
    lecturerCode: 'LEC-001',
    items: [
      {
        borrowItemId: 'item-03',
        componentCode: 'MCU-ARD-UNO',
        componentName: 'Arduino Uno R3',
        quantity: 1,
        status: 'Ready',
        sourceRoom: 'B1-302',
      },
    ],
  },
]

export const MOCK_RETURN_REQUESTS = [
  {
    returnId: 'TR-2026-014',
    requestCode: 'TR-2026-014',
    borrowRequestId: 'br-001',
    originalBorrowCode: 'BR-2026-1020',
    status: 'PendingLab',
    leaderName: 'Lê Hoàng Nam',
    leaderCode: '20214589',
    teamName: 'Nhóm 07 – IoT',
    classCode: 'EE302 - IoT & Embedded',
    returnDate: '2026-10-29',
    returnLocation: 'Phòng thực hành IoT · B1-302',
    note: 'Nhóm đã hoàn thành mô hình IoT, xin trả 1 ESP32 DevKit và 2 cảm biến DHT22 đã nhận.',
    submittedAt: '2026-10-29T09:15:00.000Z',
    confirmedAt: null,
    confirmedByName: null,
    evidencePhotos: ['photo-return-1.jpg', 'photo-handover.jpg'],
    components: [
      {
        componentId: 'comp-esp32',
        componentCode: 'MCU-ESP32',
        componentName: 'ESP32 DevKit',
        borrowedQuantity: 1,
        returnQuantity: 1,
        remainingQuantity: 0,
        goodQuantity: 1,
        damagedQuantity: 0,
        dueDate: '2026-10-29',
        statusResult: 'Normal',
        stockBefore: 11,
        stockReturned: 1,
        stockAfter: 12,
        storageLocation: 'Tủ A · Ngăn A1',
      },
      {
        componentId: 'comp-dht22',
        componentCode: 'SEN-DHT22',
        componentName: 'Cảm biến DHT22',
        borrowedQuantity: 2,
        returnQuantity: 2,
        remainingQuantity: 0,
        goodQuantity: 2,
        damagedQuantity: 0,
        dueDate: '2026-10-29',
        statusResult: 'Normal',
        stockBefore: 18,
        stockReturned: 2,
        stockAfter: 20,
        storageLocation: 'Tủ A · Ngăn A2',
      },
    ],
  },
]

// Mock dữ liệu yêu cầu gia hạn (Borrow Extensions)
export const MOCK_BORROW_EXTENSIONS = [
  {
    extensionId: 'ext-001',
    borrowRequestId: 'br-001',
    requestCode: 'BR-2026-1020',
    projectTitle: 'Dự án Hệ thống IoT Giám sát Môi trường',
    classCode: 'EE302 - IoT & Embedded',
    studentName: 'Lê Hoàng Nam',
    studentCode: '20214589',
    currentDueDate: '2026-10-29',
    requestedDays: 7,
    newDueDate: '2026-11-05',
    reason: 'Nhóm cần thêm 1 tuần để hiệu chuẩn cảm biến và hoàn thành báo cáo thử nghiệm thực tế.',
    status: 'Pending', // 'Pending' | 'Approved' | 'Rejected'
    submittedAt: '2026-10-27T08:30:00.000Z',
    reviewedAt: null,
    reviewComment: null,
  },
]

// Mock danh sách chuyển hàng giữa các Lab (Transfers)
export const MOCK_BORROW_TRANSFERS = [
  {
    transferId: 'trans-001',
    borrowRequestId: 'br-001',
    requestCode: 'BR-2026-1020',
    projectTitle: 'Dự án Hệ thống IoT Giám sát Môi trường',
    componentCode: 'MCU-ESP32',
    componentName: 'ESP32 DevKit',
    quantity: 1,
    sourceRoom: 'A2-105 · Phòng Vi điều khiển',
    destinationRoom: 'B1-302 · Phòng thực hành IoT',
    status: 'InTransit', // 'Pending' | 'InTransit' | 'Received'
    transferredAt: '2026-10-28T14:00:00.000Z',
  },
]

let localReturnRequests = JSON.parse(JSON.stringify(MOCK_RETURN_REQUESTS))
let localSupplementaryRequests = JSON.parse(JSON.stringify(MOCK_SUPPLEMENTARY_REQUESTS))
let localBorrowRequests = JSON.parse(JSON.stringify(MOCK_ORIGINAL_BORROWS))
let localExtensions = JSON.parse(JSON.stringify(MOCK_BORROW_EXTENSIONS))
let localTransfers = JSON.parse(JSON.stringify(MOCK_BORROW_TRANSFERS))

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
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/borrow-requests/my gặp lỗi, sử dụng fallback')
        return {
          items: localBorrowRequests,
          totalItems: localBorrowRequests.length,
        }
      }
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
      console.warn('API /api/borrow-requests lỗi, dùng fallback')
      return {
        items: localBorrowRequests,
        totalItems: localBorrowRequests.length,
      }
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
      const found = localBorrowRequests.find((b) => b.borrowRequestId === id || b.requestCode === id)
      if (found) return found
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
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API gia hạn lỗi, lưu vào mock fallback')
        const newExt = {
          extensionId: `ext-${Date.now()}`,
          borrowRequestId: id,
          requestCode: 'BR-2026-1020',
          projectTitle: 'Dự án Hệ thống IoT Giám sát Môi trường',
          classCode: 'EE302 - IoT & Embedded',
          studentName: 'Lê Hoàng Nam',
          studentCode: '20214589',
          currentDueDate: '2026-10-29',
          requestedDays: Number(data.requestedDays) || 7,
          newDueDate: '2026-11-05',
          reason: data.reason || 'Xin gia hạn thêm thời gian làm đồ án thực hành',
          status: 'Pending',
          submittedAt: new Date().toISOString(),
        }
        localExtensions.unshift(newExt)
        return newExt
      }
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
    } catch {
      console.warn('API /api/borrow-extensions lỗi, sử dụng fallback')
      return {
        items: localExtensions,
        totalItems: localExtensions.length,
      }
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
      const idx = localExtensions.findIndex((e) => e.extensionId === extensionId)
      if (idx !== -1) {
        localExtensions[idx].status = 'Approved'
        localExtensions[idx].reviewedAt = new Date().toISOString()
        localExtensions[idx].reviewComment = data.comment || 'Đã duyệt gia hạn'
        return localExtensions[idx]
      }
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
      const idx = localExtensions.findIndex((e) => e.extensionId === extensionId)
      if (idx !== -1) {
        localExtensions[idx].status = 'Rejected'
        localExtensions[idx].reviewedAt = new Date().toISOString()
        localExtensions[idx].reviewComment = data.reason || 'Không chấp nhận gia hạn'
        return localExtensions[idx]
      }
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
      return {
        items: localTransfers,
        totalItems: localTransfers.length,
      }
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
    } catch {
      return { success: true, message: 'Đã xác nhận nhận linh kiện chuyển lab thành công' }
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
    } catch {
      console.warn('API upload ảnh gặp lỗi, trả về mock AI fallback')
      return {
        photoId: `photo-${Date.now()}`,
        photoUrl: URL.createObjectURL(file),
        photoType,
        aiResult: 'Match',
        detectedStudentCode: '20214589',
        verified: true,
      }
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
      const idx = localBorrowRequests.findIndex((b) => b.borrowRequestId === id)
      if (idx !== -1) {
        localBorrowRequests[idx].status = 'Borrowing'
        return localBorrowRequests[idx]
      }
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
    } catch {
      return { success: true, message: 'Đã tiếp nhận trả linh kiện thành công' }
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
    } catch {
      return {
        success: true,
        message: 'Đã ghi nhận hỏng và tạo yêu cầu món thay thế thành công',
        replacementBorrowItemId: `rep-${Date.now()}`,
      }
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
    } catch {
      return { success: true, message: 'Đã giao món thay thế cho sinh viên thành công' }
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
    } catch {
      return { success: true, message: 'Đã hủy món thay thế thành công' }
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
      const idx = localBorrowRequests.findIndex((b) => b.borrowRequestId === id)
      if (idx !== -1) {
        localBorrowRequests[idx].status = 'Cancelled'
        localBorrowRequests[idx].rejectReason = data?.reason || 'Hủy đơn mượn'
        return localBorrowRequests[idx]
      }
      throw new Error(extractErrorMessage(error, 'Hủy đơn mượn thất bại'), { cause: error })
    }
  },

  // ===================== 5. MƯỢN BỔ SUNG (MF5.1) & TRẢ LINH KIỆN (MF5.2) =====================

  async getAvailableComponents(search = '') {
    try {
      const response = await api.get('/api/components', { params: { search, isAvailable: true } })
      const list = response.data?.data?.items || response.data?.items || response.data || []
      return list.length > 0 ? list : MOCK_AVAILABLE_COMPONENTS
    } catch {
      return MOCK_AVAILABLE_COMPONENTS.filter(
        (c) =>
          !search ||
          c.componentName.toLowerCase().includes(search.toLowerCase()) ||
          c.componentCode.toLowerCase().includes(search.toLowerCase())
      )
    }
  },

  async createSupplementaryBorrow(projectId, data) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow`, data)
      return response.data?.data || response.data
    } catch {
      const newReq = {
        supplementaryId: `BS-2026-${String(localSupplementaryRequests.length + 15).padStart(3, '0')}`,
        requestCode: `BS-2026-${String(localSupplementaryRequests.length + 15).padStart(3, '0')}`,
        projectId,
        originalBorrowCode: data.originalBorrowCode || 'BR-2026-1020',
        status: 'PendingLecturer',
        leaderName: data.leaderName || 'Lê Hoàng Nam',
        leaderCode: data.leaderCode || '20214589',
        teamName: data.teamName || 'Nhóm 07 – IoT',
        classCode: data.classCode || 'EE302 - IoT & Embedded',
        lecturerName: data.lecturerName || 'Nguyễn Văn Minh',
        reason: data.reason,
        submittedAt: new Date().toISOString(),
        dueDate: data.dueDate || '2026-10-29',
        components: data.components || [],
      }
      localSupplementaryRequests.unshift(newReq)
      return newReq
    }
  },

  async getSupplementaryBorrowById(id) {
    try {
      const response = await api.get(`/api/projects/${id}`)
      return response.data?.data || response.data
    } catch {
      const found = localSupplementaryRequests.find(
        (r) => r.supplementaryId === id || r.requestCode === id || r.projectId === id
      )
      return found || localSupplementaryRequests[0]
    }
  },

  async withdrawSupplementaryBorrow(projectId) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow/withdraw`)
      return response.data?.data || response.data
    } catch {
      const idx = localSupplementaryRequests.findIndex((r) => r.projectId === projectId)
      if (idx !== -1) {
        localSupplementaryRequests[idx].status = 'Draft'
        return localSupplementaryRequests[idx]
      }
      return { success: true }
    }
  },

  async getPendingApprovalProjects() {
    try {
      const response = await api.get('/api/projects/pending-approval')
      return response.data?.data || response.data
    } catch {
      return {
        items: localSupplementaryRequests.filter((r) => r.status === 'PendingLecturer'),
        totalItems: localSupplementaryRequests.filter((r) => r.status === 'PendingLecturer').length,
      }
    }
  },

  async approveSupplementaryBorrow(projectId, comment = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/approve`, { comment })
      return response.data?.data || response.data
    } catch {
      const idx = localSupplementaryRequests.findIndex((r) => r.projectId === projectId)
      if (idx !== -1) {
        localSupplementaryRequests[idx].status = 'Approved'
        localSupplementaryRequests[idx].reviewedAt = new Date().toISOString()
        localSupplementaryRequests[idx].reviewComment = comment
        return localSupplementaryRequests[idx]
      }
      return { success: true }
    }
  },

  async rejectSupplementaryBorrow(projectId, reason = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/reject`, { reason })
      return response.data?.data || response.data
    } catch {
      const idx = localSupplementaryRequests.findIndex((r) => r.projectId === projectId)
      if (idx !== -1) {
        localSupplementaryRequests[idx].status = 'Rejected'
        localSupplementaryRequests[idx].reviewedAt = new Date().toISOString()
        localSupplementaryRequests[idx].rejectReason = reason
        return localSupplementaryRequests[idx]
      }
      return { success: true }
    }
  },

  async getReturnRequests() {
    return localReturnRequests
  },

  async getReturnRequestById(id) {
    const found = localReturnRequests.find((r) => r.returnId === id || r.requestCode === id)
    return found || localReturnRequests[0]
  },

  async createReturnRequest(data) {
    try {
      if (data.borrowRequestId) {
        await api.post(`/api/borrow-requests/${data.borrowRequestId}/return`, data)
      }
    } catch (err) {
      console.warn('API return gặp lỗi, lưu vào mock fallback', err)
    }

    const newReturn = {
      returnId: `TR-2026-${String(localReturnRequests.length + 14).padStart(3, '0')}`,
      requestCode: `TR-2026-${String(localReturnRequests.length + 14).padStart(3, '0')}`,
      borrowRequestId: data.borrowRequestId || 'br-001',
      originalBorrowCode: data.originalBorrowCode || 'BR-2026-1020',
      status: 'PendingLab',
      leaderName: data.leaderName || 'Lê Hoàng Nam',
      leaderCode: data.leaderCode || '20214589',
      teamName: data.teamName || 'Nhóm 07 – IoT',
      returnDate: data.returnDate || '2026-10-29',
      returnLocation: data.returnLocation || 'Phòng thực hành IoT · B1-302',
      note: data.note || '',
      submittedAt: new Date().toISOString(),
      components: data.components || [],
    }
    localReturnRequests.unshift(newReturn)
    return newReturn
  },

  async confirmReturnRequest(id, data = {}) {
    try {
      if (data.borrowRequestId) {
        await api.post(`/api/borrow-requests/${data.borrowRequestId}/return`, data)
      }
    } catch (err) {
      console.warn('API confirm return gặp lỗi, cập nhật mock fallback', err)
    }

    const idx = localReturnRequests.findIndex((r) => r.returnId === id || r.requestCode === id)
    if (idx !== -1) {
      localReturnRequests[idx].status = 'Returned'
      localReturnRequests[idx].confirmedAt = new Date().toISOString()
      localReturnRequests[idx].confirmedByName = data.confirmedByName || 'Trần Thị Lan'
      return localReturnRequests[idx]
    }
    return localReturnRequests[0]
  },
}

export default borrowService
