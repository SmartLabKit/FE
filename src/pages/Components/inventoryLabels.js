export const ITEM_STATUSES = {
  Available: { label: 'Sẵn sàng', color: 'success' },
  Borrowed: { label: 'Đang mượn', color: 'info' },
  Lost: { label: 'Mất', color: 'error' },
  Retired: { label: 'Đã thanh lý', color: 'default' },
}

export const itemStatusOf = (status) => ITEM_STATUSES[status] || { label: status || '—', color: 'default' }

export const AUDIT_STATUSES = {
  InProgress: { label: 'Đang kiểm', color: 'warning' },
  Completed: { label: 'Hoàn tất', color: 'success' },
}

export const auditStatusOf = (status) => AUDIT_STATUSES[status] || { label: status || '—', color: 'default' }

export const TRANSACTION_TYPES = {
  Receipt: 'Nhập kho',
  ReceiptCancel: 'Hủy phiếu nhập',
  Adjust: 'Điều chỉnh',
  Move: 'Chuyển tủ',
  Retire: 'Thanh lý / mất',
  Borrow: 'Cho mượn',
  Return: 'Nhận trả',
}

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const toDateInput = (value) => (value ? String(value).slice(0, 10) : '')

export const rowsOf = (result) => (Array.isArray(result) ? result : result?.items || [])

export const cabinetLabel = (cabinet) =>
  [cabinet.roomCode, cabinet.cabinetCode, cabinet.cabinetName].filter(Boolean).join(' · ')
