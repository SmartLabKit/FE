import {
  formatVietnamDate,
  formatVietnamDateTime,
  getVietnamDateInputValue,
} from '../../utils/dateFormatting'
import { locationLabel } from '../../utils/locationLabel'

export const ITEM_STATUSES = {
  Available: { label: 'Sẵn sàng', color: 'success' },
  Borrowed: { label: 'Đang mượn', color: 'info' },
  Lost: { label: 'Thất lạc (chờ tìm lại)', color: 'warning' },
  Retired: { label: 'Đã thanh lý', color: 'default' },
}

export const itemStatusOf = (status) => ITEM_STATUSES[status] || { label: status || '—', color: 'default' }

export const AUDIT_STATUSES = {
  InProgress: { label: 'Đang kiểm', color: 'warning' },
  Submitted: { label: 'Chờ duyệt', color: 'info' },
  Completed: { label: 'Hoàn tất', color: 'success' },
}

export const RECEIPT_STATUSES = {
  Completed: { label: 'Đã nhập kho', color: 'success' },
  Cancelled: { label: 'Đã hủy', color: 'default' },
}

export const receiptStatusOf = (status) => RECEIPT_STATUSES[status] || { label: status || '—', color: 'default' }

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

/** Tủ có loại chỉ cất linh kiện cùng loại; tủ chưa gắn loại cất được mọi loại (BE cũng chặn). */
export const cabinetAccepts = (cabinet, trackingType) =>
  !trackingType || !cabinet.trackingType || cabinet.trackingType === trackingType

export const cabinetLabel = (cabinet) =>
  [locationLabel(cabinet.roomCode, cabinet.cabinetCode), cabinet.cabinetName].filter(Boolean).join(' · ')
