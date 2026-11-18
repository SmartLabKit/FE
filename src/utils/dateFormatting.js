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

function getVietnamTimeParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return { hour: '12', minute: '00', second: '00' }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
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

/**
 * Kiểm tra chuỗi ngày YYYY-MM-DD có phải ngày dương lịch hợp lệ hay không (tránh 2026-02-30...).
 */
export function isValidYmdDate(dateStr) {
  if (typeof dateStr !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!match) return false
  return Boolean(formatDateParts(match[1], match[2], match[3], '-'))
}

/**
 * Chuẩn hóa chuỗi ngày linh hoạt (YYYY-MM-DD, DD/MM/YYYY, hoặc serial ngày Excel) về YYYY-MM-DD.
 */
export function parseFlexibleDateToYmd(value) {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getVietnamDateInputValue(value)
  }
  // Hỗ trợ số serial date của Excel (từ 1900-01-01)
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 80000) {
    const utcMs = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(utcMs)
    return formatDateParts(
      String(d.getUTCFullYear()),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0'),
      '-'
    )
  }
  const str = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return isValidYmdDate(str) ? str : ''
  }
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str)
  if (dmy) {
    return formatDateParts(dmy[3], dmy[2].padStart(2, '0'), dmy[1].padStart(2, '0'), '-')
  }
  return getVietnamDateInputValue(str)
}

export function getVietnamDateInputValue(value = new Date()) {
  if (!value) return ''
  const preservedDate = preserveDatePart(value, '-')
  if (preservedDate) return preservedDate

  const parts = getVietnamDateParts(value)
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : ''
}

/**
 * Tính ngày hết hạn bảo hành mặc định (+years năm) theo múi giờ Việt Nam (tránh lệch ngày UTC).
 */
export function getDefaultWarrantyDateVn(years = 1) {
  const todayVn = getVietnamDateInputValue()
  if (!isValidYmdDate(todayVn)) return ''
  const [y, m, d] = todayVn.split('-').map(Number)
  const targetYear = y + years
  // Xử lý ngày nhuận 29/02 -> 28/02 nếu năm đích không nhuận
  const candidate = formatDateParts(
    String(targetYear),
    String(m).padStart(2, '0'),
    String(d).padStart(2, '0'),
    '-'
  )
  return candidate || `${targetYear}-${String(m).padStart(2, '0')}-28`
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
 * Chuyển đổi ngày nhập kho sang chuẩn ISO UTC an toàn cho backend:
 * - Nếu là ngày hôm nay (theo giờ Việt Nam): dùng thời điểm hiện tại trừ 3 giây (tránh lỗi tương lai do lệch đồng hồ server).
 * - Nếu là ngày quá khứ: ghép ngày YYYY-MM-DD với giờ/phút/giây hiện tại tại múi giờ +07:00 (độc lập múi giờ OS trình duyệt).
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
  if (dateInput === todayVn) {
    return new Date(Date.now() - 3000).toISOString()
  }

  if (!isValidYmdDate(String(dateInput))) {
    return new Date(Date.now() - 3000).toISOString()
  }

  const timeParts = getVietnamTimeParts()
  const hour = timeParts.hour === '24' ? '00' : timeParts.hour
  const vnDate = new Date(`${dateInput}T${hour}:${timeParts.minute}:${timeParts.second}+07:00`)
  if (Number.isNaN(vnDate.getTime()) || vnDate.getTime() > Date.now()) {
    return new Date(Date.now() - 3000).toISOString()
  }

  return vnDate.toISOString()
}

/**
 * Chuyển đổi ngày hóa đơn sang chuẩn ISO an toàn (+07:00 lúc 12:00 trưa), tránh nhảy ngày khi đổi UTC và không vượt hiện tại.
 */
export function toSafeInvoiceDateIso(dateInput) {
  if (!dateInput) return null
  if (!isValidYmdDate(String(dateInput))) return null
  const todayVn = getVietnamDateInputValue()

  if (dateInput === todayVn) {
    return new Date(Date.now() - 3000).toISOString()
  }

  // Đặt 12:00 trưa giờ Việt Nam (05:00 UTC cùng ngày) -> không bao giờ bị lệch ngày ở bất kỳ múi giờ nào
  const vnNoon = new Date(`${dateInput}T12:00:00+07:00`)
  if (Number.isNaN(vnNoon.getTime())) return null
  if (vnNoon.getTime() > Date.now()) {
    return new Date(Date.now() - 3000).toISOString()
  }

  return vnNoon.toISOString()
}

/**
 * Chuyển đổi ngày hết hạn bảo hành (có thể ở tương lai) sang ISO an toàn tại 12:00 trưa giờ Việt Nam.
 */
export function toSafeWarrantyDateIso(dateInput) {
  if (!dateInput || !isValidYmdDate(String(dateInput))) return undefined
  const vnNoon = new Date(`${dateInput}T12:00:00+07:00`)
  return Number.isNaN(vnNoon.getTime()) ? undefined : vnNoon.toISOString()
}
