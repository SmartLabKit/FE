import { formatVietnamDate, getVietnamDateInputValue } from '../../utils/dateFormatting'

export const COLORS = { blue: '#0058be', green: '#15803d', amber: '#b45309', red: '#dc2626', grey: '#64748b' }

/** 08/03/2027 → 08/03 */
export const shortDate = (value) => formatVietnamDate(value).slice(0, 5)

/** Số ngày từ hôm nay tới ngày đó theo giờ Việt Nam; âm là đã qua. */
export function daysUntil(value) {
  const day = (v) => Date.parse(`${getVietnamDateInputValue(v)}T00:00:00Z`)
  return Math.round((day(value) - day(new Date())) / 86400000)
}

/** Thứ 2, 08/03/2027 */
export function longDate(value) {
  const weekday = new Date(`${getVietnamDateInputValue(value)}T00:00:00Z`).getUTCDay()
  return `${weekday === 0 ? 'Chủ nhật' : `Thứ ${weekday + 1}`}, ${formatVietnamDate(value)}`
}

/** Chữ ngắn và màu cho trạng thái phiếu trả. */
export function slipStatusText(slip) {
  switch (slip.status) {
    case 'Pending':
      return { text: 'Chờ lab duyệt', color: COLORS.amber }
    case 'Approved':
      return daysUntil(slip.appointmentDate) < 0
        ? { text: `Trễ hẹn ${shortDate(slip.appointmentDate)}`, color: COLORS.red }
        : { text: `Hẹn ${shortDate(slip.appointmentDate)}`, color: COLORS.blue }
    case 'Rejected':
      return { text: 'Bị từ chối', color: COLORS.red }
    case 'Completed':
      return { text: 'Lab đã nhận', color: COLORS.green }
    default:
      return { text: 'Đã hủy', color: COLORS.grey }
  }
}

export const isConsumable = (item) => item.trackingType === 'CONSUMABLE'

/** Dòng phụ dưới tên món: mã từng con, hoặc số lượng với vật tư tiêu hao. */
export function itemSubtitle(item, quantity = item.quantity) {
  if (isConsumable(item) || !item.itemCode) return `${quantity} ${item.unit || ''}`.trim()
  return item.serialNumber ? `${item.itemCode} · ${item.serialNumber}` : item.itemCode
}

/** Kết quả lab ghi nhận cho một món đã trả. */
export function returnResult(item, status, borrowedQuantity) {
  if (status === 'Damaged') return { text: 'Hỏng', color: COLORS.red }
  if (status === 'Lost') return { text: 'Mất', color: COLORS.red }
  if (status !== 'Returned') return null
  return { text: isConsumable(item) ? `Đã trả ${item.returnedQuantity}/${borrowedQuantity}` : 'Đã trả', color: COLORS.green }
}
