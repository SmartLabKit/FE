import api, { extractErrorMessage } from './api'

// Mock data ban đầu phục vụ preview và fallback khi backend chưa có dữ liệu mượn bổ sung
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

// Danh mục linh kiện sẵn có để mượn bổ sung
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

// Danh sách đơn mượn gốc có thể bổ sung
export const MOCK_ORIGINAL_BORROWS = [
  {
    borrowRequestId: 'br-001',
    requestCode: 'BR-2026-1020',
    projectId: 'proj-001',
    projectTitle: 'Dự án Hệ thống IoT Giám sát Môi trường',
    classCode: 'EE302 - IoT & Embedded',
    teamName: 'Nhóm 07 – IoT',
    dueDate: '2026-10-29',
    lecturerName: 'Nguyễn Văn Minh',
    lecturerCode: 'LEC-012',
  },
  {
    borrowRequestId: 'br-002',
    requestCode: 'BR-2026-1018',
    projectId: 'proj-002',
    projectTitle: 'Thiết kế Robot Dò đường Thông minh',
    classCode: 'ME204 - Robotics',
    teamName: 'Nhóm 03 – Robotics',
    dueDate: '2026-11-15',
    lecturerName: 'TS. Nguyễn Văn Thành',
    lecturerCode: 'LEC-001',
  },
]

let localSupplementaryRequests = JSON.parse(JSON.stringify(MOCK_SUPPLEMENTARY_REQUESTS))

export const borrowService = {
  /**
   * Lấy danh sách đơn mượn của người dùng hiện tại (Sinh viên)
   * GET /api/borrow-requests/my
   */
  async getMyBorrowRequests(params = {}) {
    try {
      const response = await api.get('/api/borrow-requests/my', { params })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/borrow-requests/my gặp lỗi, sử dụng fallback')
        return {
          items: MOCK_ORIGINAL_BORROWS,
          totalItems: MOCK_ORIGINAL_BORROWS.length,
        }
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách đơn mượn của bạn'), { cause: error })
    }
  },

  /**
   * Lấy chi tiết đơn mượn
   * GET /api/borrow-requests/{id}
   */
  async getBorrowRequestById(id) {
    try {
      const response = await api.get(`/api/borrow-requests/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      const found = MOCK_ORIGINAL_BORROWS.find((b) => b.borrowRequestId === id || b.requestCode === id)
      if (found) return found
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết đơn mượn'), { cause: error })
    }
  },

  /**
   * Lấy danh sách linh kiện khả dụng để chọn mượn bổ sung
   * GET /api/components
   */
  async getAvailableComponents(search = '') {
    try {
      const response = await api.get('/api/components', { params: { search, isAvailable: true } })
      const list = response.data?.data?.items || response.data?.items || response.data || []
      return list.length > 0 ? list : MOCK_AVAILABLE_COMPONENTS
    } catch (error) {
      console.warn('API /api/components gặp lỗi, sử dụng mock linh kiện', error)
      return MOCK_AVAILABLE_COMPONENTS.filter(
        (c) =>
          !search ||
          c.componentName.toLowerCase().includes(search.toLowerCase()) ||
          c.componentCode.toLowerCase().includes(search.toLowerCase())
      )
    }
  },

  /**
   * Tạo phiếu mượn bổ sung (Actor: Sinh viên / Nhóm trưởng)
   * POST /api/projects/{projectId}/supplementary-borrow
   * Body: SupplementaryBorrowRequest { reason, borrowDate, dueDate, components: [{ componentId, quantity }] }
   */
  async createSupplementaryBorrow(projectId, data) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow`, data)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API mượn bổ sung gặp lỗi, lưu vào mock fallback')
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
      throw new Error(extractErrorMessage(error, 'Gửi yêu cầu mượn bổ sung thất bại'), { cause: error })
    }
  },

  /**
   * Lấy chi tiết phiếu mượn bổ sung theo mã hoặc id
   */
  async getSupplementaryBorrowById(id) {
    try {
      const response = await api.get(`/api/projects/${id}`)
      return response.data?.data || response.data
    } catch {
      const found = localSupplementaryRequests.find((r) => r.supplementaryId === id || r.requestCode === id || r.projectId === id)
      if (found) return found
      return localSupplementaryRequests[0]
    }
  },

  /**
   * Rút phiếu mượn bổ sung (Actor: Sinh viên)
   * POST /api/projects/{projectId}/supplementary-borrow/withdraw
   */
  async withdrawSupplementaryBorrow(projectId) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow/withdraw`)
      return response.data?.data || response.data
    } catch (error) {
      const idx = localSupplementaryRequests.findIndex((r) => r.projectId === projectId || r.supplementaryId === projectId)
      if (idx !== -1) {
        localSupplementaryRequests[idx].status = 'Draft'
        return localSupplementaryRequests[idx]
      }
      throw new Error(extractErrorMessage(error, 'Rút yêu cầu thất bại'), { cause: error })
    }
  },

  /**
   * Danh sách yêu cầu chờ duyệt dành cho Giảng viên
   * GET /api/projects/pending-approval
   */
  async getPendingApprovalProjects() {
    try {
      const response = await api.get('/api/projects/pending-approval')
      return response.data?.data || response.data
    } catch {
      console.warn('API /api/projects/pending-approval lỗi, sử dụng mock requests')
      return {
        items: localSupplementaryRequests.filter((r) => r.status === 'PendingLecturer'),
        totalItems: localSupplementaryRequests.filter((r) => r.status === 'PendingLecturer').length,
      }
    }
  },

  /**
   * Giảng viên duyệt yêu cầu mượn bổ sung
   * POST /api/projects/{projectId}/approve
   * Body: { comment }
   */
  async approveSupplementaryBorrow(projectId, comment = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/approve`, { comment })
      return response.data?.data || response.data
    } catch (error) {
      const idx = localSupplementaryRequests.findIndex((r) => r.projectId === projectId || r.supplementaryId === projectId)
      if (idx !== -1) {
        localSupplementaryRequests[idx].status = 'Approved'
        localSupplementaryRequests[idx].reviewedAt = new Date().toISOString()
        localSupplementaryRequests[idx].reviewComment = comment
        return localSupplementaryRequests[idx]
      }
      throw new Error(extractErrorMessage(error, 'Duyệt yêu cầu thất bại'), { cause: error })
    }
  },

  /**
   * Giảng viên từ chối yêu cầu mượn bổ sung
   * POST /api/projects/{projectId}/reject
   * Body: { reason }
   */
  async rejectSupplementaryBorrow(projectId, reason = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/reject`, { reason })
      return response.data?.data || response.data
    } catch (error) {
      const idx = localSupplementaryRequests.findIndex((r) => r.projectId === projectId || r.supplementaryId === projectId)
      if (idx !== -1) {
        localSupplementaryRequests[idx].status = 'Rejected'
        localSupplementaryRequests[idx].reviewedAt = new Date().toISOString()
        localSupplementaryRequests[idx].rejectReason = reason
        return localSupplementaryRequests[idx]
      }
      throw new Error(extractErrorMessage(error, 'Từ chối yêu cầu thất bại'), { cause: error })
    }
  },
}
