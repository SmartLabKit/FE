function formatDateParts(year, month, day, separator = '/') {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return ''
  }
  return separator === '/'
    ? `${day}/${month}/${year}`
    : `${year}-${month}-${day}`
}

function getVietnamDateParts(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
}

function preserveDatePart(value, separator) {
  if (typeof value !== 'string') return ''
  const source = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(source)
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(source)
  return match && !hasTimezone
    ? formatDateParts(match[1], match[2], match[3], separator)
    : ''
}

export function getVietnamDateInputValue(value = new Date()) {
  if (!value) return ''
  const preservedDate = preserveDatePart(value, '-')
  if (preservedDate) return preservedDate

  const parts = getVietnamDateParts(value)
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : ''
}

export function formatVietnamDate(value) {
  if (!value) return '—'
  const preservedDate = preserveDatePart(value, '/')
  if (preservedDate) return preservedDate

  if (typeof value === 'string') {
    const localizedDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
    if (localizedDate) {
      return formatDateParts(localizedDate[3], localizedDate[2], localizedDate[1]) || '—'
    }
  }

  const parts = getVietnamDateParts(value)
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : '—'
}

export function formatVietnamDateTime(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(date)
}

/**
 * Chuyển đổi ngày nhận hàng sang chuẩn ISO UTC an toàn cho backend:
 * - Nếu là ngày hôm nay: dùng chính xác thời điểm hiện tại (trừ 3 giây chống lệch đồng hồ với server, không bị lỗi tương lai).
 * - Nếu là ngày quá khứ: kết hợp ngày được chọn với giờ/phút/giây hiện tại theo múi giờ Việt Nam (tránh bị mặc định về 07:00:00 sáng).
 * - Đảm bảo không bao giờ vượt quá thời điểm hiện tại (DateTime.UtcNow) của backend.
 */
export function toReceiptReceivedAtIso(dateInput) {
  if (!dateInput) {
    return new Date(Date.now() - 3000).toISOString()
  }

  if (typeof dateInput === 'string' && dateInput.includes('T')) {
    const d = new Date(dateInput)
    if (!Number.isNaN(d.getTime())) {
      return (d.getTime() > Date.now() ? new Date(Date.now() - 3000) : d).toISOString()
    }
  }

  const todayVn = getVietnamDateInputValue()
  const now = new Date()

  if (dateInput === todayVn) {
    return new Date(Date.now() - 3000).toISOString()
  }

  const [y, m, d] = String(dateInput).split('-').map(Number)
  if (!y || !m || !d) {
    return new Date(Date.now() - 3000).toISOString()
  }

  // Ghép ngày quá khứ với giờ phút giây hiện tại theo múi giờ địa phương
  const localDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
  if (localDate.getTime() > Date.now()) {
    return new Date(Date.now() - 3000).toISOString()
  }

  return localDate.toISOString()
}

/**
 * Chuyển đổi ngày hóa đơn sang chuẩn ISO an toàn, tránh lệch ngày do múi giờ và không vượt quá hiện tại.
 */
export function toSafeInvoiceDateIso(dateInput) {
  if (!dateInput) return null
  const todayVn = getVietnamDateInputValue()
  const now = new Date()

  if (dateInput === todayVn) {
    return new Date(Date.now() - 3000).toISOString()
  }

  const [y, m, d] = String(dateInput).split('-').map(Number)
  if (!y || !m || !d) return null

  // Đặt 12:00 trưa địa phương để an toàn, không nhảy ngày khi chuyển đổi UTC
  const localDate = new Date(y, m - 1, d, 12, 0, 0)
  if (localDate.getTime() > Date.now()) {
    return new Date(Date.now() - 3000).toISOString()
  }

  return localDate.toISOString()
}
