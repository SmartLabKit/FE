import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'

export const formatDate = formatVietnamDate
export const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN')
export const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
export function formatDuration(hours) {
  if (hours == null) return '—'
  const totalMinutes = Math.max(0, Math.round(Number(hours) * 60))
  if (totalMinutes < 60) return `${totalMinutes} phút`
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) {
    const minutes = totalMinutes % 60
    return minutes ? `${totalHours} giờ ${minutes} phút` : `${totalHours} giờ`
  }
  const days = Math.floor(totalHours / 24)
  const restHours = totalHours % 24
  return restHours ? `${days} ngày ${restHours} giờ` : `${days} ngày`
}
export const formatPercent = (value) =>
  value == null ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

const LABELS = {
  Pending: 'Chờ GV duyệt',
  Approved: 'Chờ lab xác nhận',
  Ready: 'Sẵn sàng nhận linh kiện',
  Rejected: 'Từ chối',
  Borrowing: 'Đang mượn',
  Returned: 'Đã trả',
  Overdue: 'Quá hạn',
  Cancelled: 'Đã hủy',
  Open: 'Đang mở',
  Confirmed: 'Đã xác nhận',
  Damaged: 'Hư hỏng',
  Burnt: 'Cháy',
  Lost: 'Mất',
  Good: 'Tốt',
  Available: 'Sẵn sàng',
  Borrowed: 'Đang mượn',
  Retired: 'Thanh lý',
  Receipt: 'Nhập kho',
  ReceiptCancel: 'Hủy phiếu nhập',
  Adjust: 'Điều chỉnh',
  Move: 'Chuyển tủ',
  Retire: 'Thanh lý',
  Borrow: 'Cho mượn',
  Return: 'Nhận trả',
}
const MOVEMENT_LABELS = {
  Adjust: 'Điều chỉnh, kiểm kê',
  Move: 'Chuyển với lab khác',
  Retire: 'Mất, thanh lý, tìm lại được',
}
export const movementLabel = (key) => MOVEMENT_LABELS[key] || toLabel(key)

/** 2026-11 → 11/2026 */
export const formatMonth = (key) => (/^\d{4}-\d{2}$/.test(key || '') ? `${key.slice(5)}/${key.slice(0, 4)}` : key)

export const toLabel = (key) => LABELS[key] || key || '—'

export const CHART_COLORS = ['#0058be', '#2e7d32', '#ef6c00', '#5856d6', '#30b0c7', '#8e8e93']
export const CHART_DANGER = '#c62828'

export function niceStep(raw, minimum = 1) {
  if (raw <= 0) return minimum
  let magnitude = 1
  while (magnitude * 10 <= raw) magnitude *= 10
  while (magnitude > raw) magnitude /= 10
  for (const factor of [1, 2, 2.5, 3, 4, 5, 10]) {
    if (magnitude * factor >= raw) return magnitude * factor
  }
  return magnitude * 10
}

export function formatMoneyAxis(value) {
  const trim = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))
  if (value === 0) return '0'
  if (value >= 1e9) return `${trim(value / 1e9)}tỷ`
  if (value >= 1e6) return `${trim(value / 1e6)}tr`
  return `${trim(value / 1e3)}k`
}

export const stockCardPath = (componentId) => `/reports?tab=movements&componentId=${componentId}`

export const getRows = (result) => (Array.isArray(result) ? result : result?.items || [])

export const PERIOD_PRESETS = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
  { days: 365, label: '1 năm' },
]

/**
 * Kỳ báo cáo gồm `days` ngày, kết thúc hôm nay theo giờ Việt Nam. BE nhận ngày lịch Việt Nam dạng yyyy-MM-dd
 * và tính cả 2 đầu, nên fromDate = hôm nay trừ (days - 1). Tối đa 366 ngày.
 */
export function defaultPeriod(days = 30) {
  const to = new Date()
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return {
    fromDate: getVietnamDateInputValue(from),
    toDate: getVietnamDateInputValue(to),
    days,
  }
}

export const formatDayString = (value) => {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
