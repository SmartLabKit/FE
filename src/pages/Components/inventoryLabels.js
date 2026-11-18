import {
  formatVietnamDate,
  formatVietnamDateTime,
  getVietnamDateInputValue,
} from '../../utils/dateFormatting'

export const ITEM_STATUSES = {
  Available: { label: 'Sẵn sàng', color: 'success' },
  Borrowed: { label: 'Đang mượn', color: 'info' },
  Lost: { label: 'Thất lạc (chờ tìm lại)', color: 'warning' },
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
  Adjust: 'Điều chỉnh kiểm kê',
  Move: 'Chuyển tủ / Khôi phục',
  Retire: 'Ghi nhận thất lạc / Thanh lý',
  Borrow: 'Cho mượn',
  Return: 'Nhận trả',
}

export const formatDate = (value) => formatVietnamDate(value)

export const formatDateTime = (value) => formatVietnamDateTime(value)

export const toDateInput = (value) => getVietnamDateInputValue(value)

export const rowsOf = (result) => (Array.isArray(result) ? result : result?.items || [])

export const cabinetLabel = (cabinet) =>
  [cabinet.roomCode, cabinet.cabinetCode, cabinet.cabinetName].filter(Boolean).join(' · ')
