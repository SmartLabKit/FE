/**
 * Định nghĩa chuẩn nhãn và style hiển thị cho các trạng thái đơn mượn (Borrow Requests)
 */
export function getBorrowRequestStatusMeta(status) {
  const norm = String(status || '').trim()
  switch (norm) {
    case 'Returned':
    case 'Return':
    case 'đã trả':
    case 'Đã trả':
      return {
        label: 'Đã trả',
        color: 'success',
        sx: { bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 },
      }
    case 'Borrowing':
    case 'đang mượn':
    case 'Đang mượn':
      return {
        label: 'Đang mượn',
        color: 'primary',
        sx: { bgcolor: '#eff6ff', color: '#0058be', fontWeight: 700 },
      }
    case 'Ready':
    case 'sẵn sàng':
    case 'Sẵn sàng':
      return {
        label: 'Sẵn sàng giao',
        color: 'success',
        sx: { bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 },
      }
    case 'Approved':
    case 'đã duyệt':
    case 'Đã duyệt':
      return {
        label: 'Chờ lab xác nhận',
        color: 'warning',
        sx: { bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700 },
      }
    case 'Overdue':
    case 'quá hạn':
    case 'Quá hạn':
      return {
        label: 'Quá hạn',
        color: 'error',
        sx: { bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 700 },
      }
    case 'Cancelled':
    case 'đã hủy':
    case 'Đã hủy':
      return {
        label: 'Đã hủy',
        color: 'default',
        sx: { bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 700 },
      }
    case 'Rejected':
    case 'từ chối':
    case 'Từ chối':
      return {
        label: 'Từ chối',
        color: 'error',
        sx: { bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 700 },
      }
    case 'PendingLecturer':
    case 'PendingApproval':
    case 'Pending':
      return {
        label: 'Chờ GV duyệt',
        color: 'warning',
        sx: { bgcolor: '#fffbeb', color: '#b45309', fontWeight: 700 },
      }
    default:
      return {
        label: norm || '—',
        color: 'default',
        sx: { fontWeight: 700 },
      }
  }
}

/** Quyết định của giảng viên trong lịch sử duyệt: Approved nghĩa là đã duyệt, khác trạng thái của cả đơn. */
export function getApprovalStatusMeta(status) {
  if (status !== 'Approved') return getBorrowRequestStatusMeta(status)
  return {
    label: 'Đã duyệt',
    color: 'success',
    sx: { bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700 },
  }
}

export function formatBorrowRequestStatus(status) {
  return getBorrowRequestStatusMeta(status).label
}

const DAY_MS = 24 * 60 * 60 * 1000
const BORROWED = ['Borrowing', 'Overdue']

/** Số ngày đã quá hạn trả (0 khi chưa quá hạn hoặc không đang mượn). */
export function overdueDays(request) {
  if (!request || !BORROWED.includes(request.status) || !request.dueDate) return 0
  const late = Date.now() - new Date(request.dueDate).getTime()
  if (late <= 0) return 0
  return Math.max(1, Math.floor(late / DAY_MS))
}

/**
 * Tình trạng đơn mượn theo cách giảng viên dễ đọc: đơn đang ở bước nào (lab chuẩn bị, chờ nhận, đang mượn, quá hạn, đã trả).
 * Trả về { key, label, sx } với key dùng để lọc: preparing | ready | borrowing | overdue | returned | pending | closed.
 */
export function borrowProgressOf(request) {
  const chip = (bgcolor, color) => ({ bgcolor, color, fontWeight: 700, fontSize: 11 })
  if (!request) return null
  const late = overdueDays(request)
  if (late > 0 || request.isOverdue) {
    return { key: 'overdue', label: `Quá hạn ${Math.max(late, 1)} ngày`, sx: chip('#fef2f2', '#dc2626') }
  }
  switch (request.status) {
    case 'Pending':
      return { key: 'pending', label: 'Chờ GV duyệt', sx: chip('#fffbeb', '#b45309') }
    case 'Approved':
      return { key: 'preparing', label: 'Lab đang chuẩn bị', sx: chip('#fffbeb', '#b45309') }
    case 'Ready':
      return { key: 'ready', label: 'Chờ nhận linh kiện', sx: chip('#ecfeff', '#0e7490') }
    case 'Borrowing':
      return { key: 'borrowing', label: `Đang mượn · hạn ${formatShortDate(request.dueDate)}`, sx: chip('#eff6ff', '#0058be') }
    case 'Returned':
      return { key: 'returned', label: 'Đã trả', sx: chip('#ecfdf5', '#047857') }
    case 'Rejected':
      return { key: 'closed', label: 'Bị từ chối', sx: chip('#f1f5f9', '#64748b') }
    default:
      return { key: 'closed', label: 'Đã hủy', sx: chip('#f1f5f9', '#64748b') }
  }
}

function formatShortDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }).format(new Date(value))
}

/** Đơn đại diện cho tình trạng mượn của một đề tài: đơn đang mở (hạn trả gần nhất) trước, không có thì đơn mới nhất. */
export function currentRequestOfProject(requests, projectId) {
  const own = requests.filter((r) => r.projectId === projectId && r.status !== 'Cancelled' && r.status !== 'Rejected')
  const open = own.filter((r) => r.status !== 'Returned')
  if (open.length > 0) {
    return [...open].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]
  }
  return [...own].sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))[0] || null
}

/** Đơn mượn thêm: BE ghi mục đích "Mượn bổ sung cho project: ...". */
export function isSupplementaryPurpose(purpose) {
  return String(purpose || '').trim().toLowerCase().startsWith('mượn bổ sung')
}

/** Đơn mượn đầu của đề tài có mục đích tự sinh, chỉ lặp lại tên đề tài nên không hiện. */
export function getShownPurpose(purpose) {
  const text = String(purpose || '').trim()
  return text.startsWith('Mượn linh kiện cho project:') ? '' : text
}
