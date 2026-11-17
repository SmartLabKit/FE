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
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date)
}
