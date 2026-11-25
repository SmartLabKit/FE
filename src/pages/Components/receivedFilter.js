import { getVietnamDateInputValue } from '../../utils/dateFormatting'

export const RECEIVED_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'today', label: 'Nhập hôm nay', days: 1 },
  { value: '7', label: 'Nhập 7 ngày qua', days: 7 },
  { value: '30', label: 'Nhập 30 ngày qua', days: 30 },
  { value: 'receipt', label: 'Theo phiếu nhập' },
  { value: 'none', label: 'Mới khai báo, chưa nhập kho' },
]

/** Vừa khai báo bằng Excel: chỉ có khi đi từ trang khai báo sang. */
export const JUST_CREATED_OPTION = { value: 'created', label: 'Vừa khai báo từ Excel' }

export const receivedQuantity = (receipt) => receipt.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)

export const receivedAmount = (receipt) =>
  receipt.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)

function firstDay(days) {
  const date = new Date()
  date.setDate(date.getDate() - (days - 1))
  return getVietnamDateInputValue(date)
}

/** Phiếu nhập (GET /api/stock-receipts/{id}) thành { componentId → cùng dạng với latestReceipt của danh sách linh kiện }. */
export function receiptByComponent(receipt) {
  const map = new Map()
  ;(receipt?.items || []).forEach((line) => {
    const entry = map.get(line.componentId) || {
      receiptId: receipt.receiptId,
      receiptCode: receipt.receiptCode,
      createdAt: receipt.createdAt,
      lines: [],
    }
    entry.lines.push({ quantity: line.quantity, unitPrice: line.unitPrice, cabinetCode: line.cabinetCode })
    map.set(line.componentId, entry)
  })
  return map
}

/** Linh kiện khớp ô lọc "Mới nhập", mới nhất trước; mỗi dòng kèm phiếu nhập để hiện ở cột "Nhập gần nhất". */
export function applyReceivedFilter(components, filter, { receiptLines = new Map(), createdIds = [] } = {}) {
  const byNewest = (dateOf) => (a, b) =>
    String(dateOf(b) || '').localeCompare(String(dateOf(a) || '')) || a.componentName.localeCompare(b.componentName, 'vi')
  const withReceipt = components.map((c) => ({ ...c, shownReceipt: c.latestReceipt || null }))

  if (filter === 'receipt') {
    return components
      .filter((c) => receiptLines.has(c.componentId))
      .map((c) => ({ ...c, shownReceipt: receiptLines.get(c.componentId) }))
      .sort((a, b) => a.componentCode.localeCompare(b.componentCode))
  }
  if (filter === 'none') return withReceipt.filter((c) => !c.latestReceipt).sort(byNewest((c) => c.createdAt))
  if (filter === 'created') {
    return withReceipt.filter((c) => createdIds.includes(c.componentId)).sort(byNewest((c) => c.createdAt))
  }
  const days = RECEIVED_OPTIONS.find((o) => o.value === filter)?.days
  if (!days) return withReceipt
  const from = firstDay(days)
  return withReceipt
    .filter((c) => c.latestReceipt && getVietnamDateInputValue(c.latestReceipt.createdAt) >= from)
    .sort(byNewest((c) => c.latestReceipt.createdAt))
}
