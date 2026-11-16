// Hàm định dạng và nhãn tiếng Việt dùng chung cho màn hình Tổng quan và Báo cáo.

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')
export const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN')
export const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`
export const formatHours = (value) =>
  value == null ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`
// BE trả tỉ lệ đã nhân 100 (ví dụ 12.5 nghĩa là 12,5%)
export const formatPercent = (value) =>
  value == null ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

// Nhãn tiếng Việt cho các mã trạng thái / loại trả về từ BE (không có thì hiển thị nguyên mã)
const LABELS = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Ready: 'Sẵn sàng giao',
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
export const toLabel = (key) => LABELS[key] || key || '—'

// Màu các lát / cột biểu đồ theo thứ tự (giống bảng màu app mobile, màu chính theo web)
export const CHART_COLORS = ['#0058be', '#2e7d32', '#ef6c00', '#5856d6', '#30b0c7', '#8e8e93']
export const CHART_DANGER = '#c62828'

// Làm tròn bước lưới trục Y lên 1 / 2 / 2,5 / 3 / 4 / 5 x 10^n để vạch chia rơi vào số tròn (giống niceStep bên mobile)
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

// Nhãn trục tiền ngắn gọn: 0, 500k, 5tr, 2,5tr, 1tỷ
export function formatMoneyAxis(value) {
  const trim = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))
  if (value === 0) return '0'
  if (value >= 1e9) return `${trim(value / 1e9)}tỷ`
  if (value >= 1e6) return `${trim(value / 1e6)}tr`
  return `${trim(value / 1e3)}k`
}

// Lấy danh sách dòng từ PagedResult { items, totalCount } hoặc mảng thuần
export const getRows = (result) => (Array.isArray(result) ? result : result?.items || [])

// Khoảng thời gian mặc định của bộ lọc: 30 ngày gần nhất (định dạng yyyy-MM-dd cho input type="date")
export function defaultPeriod() {
  const toIso = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { fromDate: toIso(from), toDate: toIso(to) }
}
