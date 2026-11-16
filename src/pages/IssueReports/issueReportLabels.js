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
