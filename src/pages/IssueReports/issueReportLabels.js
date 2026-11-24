export const ISSUE_TYPES = [
  { value: 'Damaged', label: 'Hư hỏng' },
  { value: 'Burnt', label: 'Cháy' },
  { value: 'Lost', label: 'Mất' },
]

export const ISSUE_STATUSES = [
  { value: 'Open', label: 'Chờ xử lý', color: 'warning' },
  { value: 'Confirmed', label: 'Đã xác nhận', color: 'success' },
  { value: 'Rejected', label: 'Đã từ chối', color: 'error' },
  { value: 'Cancelled', label: 'Đã hủy', color: 'default' },
]

export const issueTypeLabel = (value) => ISSUE_TYPES.find((type) => type.value === value)?.label || value || '—'

export const issueStatusOf = (value) =>
  ISSUE_STATUSES.find((status) => status.value === value) || { value, label: value || '—', color: 'default' }

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

/** Câu thông báo sau khi ghi nhận sự cố (POST /api/issue-reports). */
export function issueCreatedMessage(report, { replaceRequested }) {
  if (report.status === 'Open') return 'Đã gửi báo cáo, chờ nhân viên lab kiểm tra.'
  if (!replaceRequested) return 'Đã ghi nhận sự cố.'
  if (report.replacementBorrowItemId) return 'Đã ghi nhận sự cố. Đơn có thêm con thay thế chờ giao.'
  return 'Đã ghi nhận sự cố, nhưng lab vừa hết con để đổi.'
}
