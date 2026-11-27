export const TRACKING_TYPE_LABELS = {
  CONSUMABLE: 'Tiêu hao',
  REUSABLE: 'Tái sử dụng',
  HIGH_VALUE: 'Giá trị cao',
}

/**
 * Tên tiếng Việt của loại quản lý (CONSUMABLE / REUSABLE / HIGH_VALUE). Mã lạ thì trả nguyên mã.
 */
export function trackingTypeLabel(type) {
  const code = String(type || '').trim().toUpperCase()
  return TRACKING_TYPE_LABELS[code] || code
}
