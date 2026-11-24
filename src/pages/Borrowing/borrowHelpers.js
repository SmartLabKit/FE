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
