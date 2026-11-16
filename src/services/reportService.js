import api, { extractErrorMessage } from './api'

function unwrap(response) {
  return response.data?.data ?? response.data
}

// Gọi 1 API báo cáo dạng GET và chuẩn hóa thông báo lỗi.
// 403: role hiện tại không được xem báo cáo này (ví dụ LabStaff không xem được báo cáo tiền).
async function getReport(url, params, defaultMsg) {
  try {
    return unwrap(await api.get(url, { params }))
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('Bạn không có quyền xem báo cáo này.', { cause: error })
    }
    throw new Error(extractErrorMessage(error, defaultMsg), { cause: error })
  }
}

export const reportService = {
  /**
   * Các ô số liệu trang tổng quan theo role (ô nào role không được xem thì null)
   * GET /api/reports/dashboard
   * Trả về (200): DashboardResponse { totalComponents, lowStockCount, stockValue, receiptsThisMonth,
   *   receiptAmountThisMonth, pendingApprovals, readyToIssue, borrowingCount, overdueCount }
   */
  async getDashboard() {
    return getReport('/api/reports/dashboard', undefined, 'Không thể tải số liệu tổng quan')
  },

  // ===== Báo cáo kho =====

  /**
   * Tồn kho theo linh kiện: sẵn sàng, đang mượn, mất/thanh lý
   * GET /api/reports/inventory/stock-summary
   * Query: { roomId?, categoryId?, trackingType?, search?, page?, size? }
   * Trả về (200): PagedResult<StockSummaryResponse>
   */
  async getStockSummary(params) {
    return getReport('/api/reports/inventory/stock-summary', params, 'Không thể tải báo cáo tồn kho')
  },

  /**
   * Linh kiện dưới mức tồn tối thiểu (thiếu nhiều nhất trước)
   * GET /api/reports/inventory/low-stock
   * Query: { roomId?, categoryId?, trackingType?, search?, page?, size? }
   * Trả về (200): PagedResult<LowStockResponse>
   */
  async getLowStock(params) {
    return getReport('/api/reports/inventory/low-stock', params, 'Không thể tải danh sách linh kiện sắp hết')
  },

  /**
   * Thẻ kho của 1 linh kiện trong kỳ: tồn đầu, nhập/xuất theo loại, tồn cuối
   * GET /api/reports/inventory/movements
   * Query: { componentId (bắt buộc), roomId?, fromDate?, toDate? } (tối đa 366 ngày)
   * Trả về (200): StockMovementResponse
   */
  async getStockMovements(params) {
    return getReport('/api/reports/inventory/movements', params, 'Không thể tải thẻ kho')
  },

  /**
   * Giá trị kho hiện tại, gom theo danh mục và theo lab
   * GET /api/reports/inventory/stock-value
   * Quyền: Admin, InventoryManager
   * Trả về (200): StockValueResponse { totalValue, unitValue, consumableValue, byCategory[], byRoom[] }
   */
  async getStockValue() {
    return getReport('/api/reports/inventory/stock-value', undefined, 'Không thể tải giá trị kho')
  },

  /**
   * Nhập kho theo kỳ (phiếu Completed)
   * GET /api/reports/inventory/receipts
   * Quyền: Admin, InventoryManager
   * Query: { fromDate?, toDate?, groupBy?: 'month' | 'supplier' | 'category' }
   * Trả về (200): ReceiptReportResponse { receiptCount, totalAmount, groups[] }
   */
  async getReceiptReport(params) {
    return getReport('/api/reports/inventory/receipts', params, 'Không thể tải báo cáo nhập kho')
  },

  /**
   * Hao hụt trong kỳ: mất, thanh lý, điều chỉnh giảm
   * GET /api/reports/inventory/losses
   * Quyền: Admin, InventoryManager
   * Query: { fromDate?, toDate? }
   * Trả về (200): LossReportResponse { lostUnits, retiredUnits, adjustedOutQuantity, totalValue, items[] }
   */
  async getLosses(params) {
    return getReport('/api/reports/inventory/losses', params, 'Không thể tải báo cáo hao hụt')
  },

  /**
   * Thiết bị giá trị cao sắp hết bảo hành
   * GET /api/reports/inventory/warranty-expiring
   * Query: { days? (mặc định 30), roomId?, page?, size? }
   * Trả về (200): PagedResult<WarrantyExpiringResponse>
   */
  async getWarrantyExpiring(params) {
    return getReport('/api/reports/inventory/warranty-expiring', params, 'Không thể tải danh sách sắp hết bảo hành')
  },

  // ===== Báo cáo mượn trả =====

  /**
   * Thống kê đơn mượn tạo trong kỳ
   * GET /api/reports/borrowing/summary
   * Query: { fromDate?, toDate?, roomId?, classId? }
   * Trả về (200): BorrowSummaryResponse { totalRequests, byStatus[], byRoom[], byClass[], rejectionRate, averageApprovalHours }
   */
  async getBorrowSummary(params) {
    return getReport('/api/reports/borrowing/summary', params, 'Không thể tải thống kê mượn trả')
  },

  /**
   * Mức mượn theo lớp
   * GET /api/reports/borrowing/by-class
   * Query: { fromDate?, toDate?, roomId?, classId? }
   * Trả về (200): ClassUsageResponse[]
   */
  async getClassUsage(params) {
    return getReport('/api/reports/borrowing/by-class', params, 'Không thể tải báo cáo mượn theo lớp')
  },

  /**
   * Linh kiện trả về bị hỏng hoặc mất trong kỳ
   * GET /api/reports/borrowing/damages
   * Query: { fromDate?, toDate?, roomId?, classId?, page?, size? }
   * Trả về (200): PagedResult<DamageResponse>
   */
  async getDamages(params) {
    return getReport('/api/reports/borrowing/damages', params, 'Không thể tải báo cáo hư hỏng')
  },

  /**
   * Đơn mượn quá hạn (trễ lâu nhất trước; GV chỉ thấy lớp mình, LabStaff chỉ lab mình)
   * GET /api/reports/borrowing/overdue
   * Query: { roomId?, classId?, page?, size? }
   * Trả về (200): PagedResult<OverdueBorrowResponse>
   */
  async getOverdueBorrows(params) {
    return getReport('/api/reports/borrowing/overdue', params, 'Không thể tải danh sách đơn quá hạn')
  },

  /**
   * Linh kiện được mượn nhiều nhất trong kỳ
   * GET /api/reports/borrowing/top-components
   * Query: { fromDate?, toDate?, roomId?, classId?, top? (mặc định 10) }
   * Trả về (200): TopComponentResponse[]
   */
  async getTopComponents(params) {
    return getReport('/api/reports/borrowing/top-components', params, 'Không thể tải linh kiện mượn nhiều nhất')
  },

  // ===== Báo cáo sự cố =====

  /**
   * Thống kê sự cố tạo trong kỳ
   * GET /api/reports/issues
   * Query: { fromDate?, toDate? }
   * Trả về (200): IssueSummaryResponse { totalIssues, byStatus[], byType[], topComponents[], averageResolveHours }
   */
  async getIssueSummary(params) {
    return getReport('/api/reports/issues', params, 'Không thể tải thống kê sự cố')
  },
}
