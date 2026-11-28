export function formatRelativeTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Vừa xong'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Trang cần mở khi bấm vào thông báo, dựa vào refType + role của người dùng.
 * refType do BE gửi: BorrowRequest, BorrowApproval, BorrowExtension, Project, FinalSubmission, Team, Class, InventoryAudit (refId là id tương ứng).
 * Trả về null khi không có trang phù hợp (chỉ đánh dấu đã đọc).
 */
export function getNotificationPath(notification, hasRole) {
  const is = (role) => Boolean(hasRole?.(role))
  switch (notification.refType) {
    case 'BorrowRequest':
      // Lab bấm thông báo: mở luôn chi tiết đơn trong màn Xử lý đơn mượn (có nút xác nhận, giao, nhận trả)
      if (is('LabStaff')) return notification.refId ? `/borrow/lab-orders?open=${notification.refId}` : '/borrow/lab-orders'
      return notification.refId ? `/borrow/requests/${notification.refId}` : '/borrow/my-requests'
    case 'BorrowApproval':
      // Giảng viên: đơn mượn của đề tài chờ duyệt, mở luôn hộp thoại duyệt đề tài chứa đơn đó
      if (is('Lecturer') && notification.refId) return `/borrow/my-requests?request=${notification.refId}`
      return '/borrow/my-requests'
    case 'BorrowExtension':
      return '/borrow/my-requests'
    case 'Project':
      if (is('Student')) return '/class-setup/student/project'
      // Giảng viên duyệt đề tài ở mục "Duyệt đề tài" (/borrow/my-requests), mở luôn hộp thoại của đề tài đó
      if (is('Lecturer')) return notification.refId ? `/borrow/my-requests?project=${notification.refId}` : '/borrow/my-requests'
      return null
    case 'FinalSubmission':
      // Bài nộp cuối kỳ: giảng viên xác nhận ở mục "Duyệt nộp cuối kỳ", sinh viên xem kết quả ở trang đề tài
      if (is('Lecturer')) return '/class-setup/lecturer/final-submissions'
      if (is('Student')) return '/class-setup/student/project'
      return null
    case 'Team':
    case 'Class':
      if (is('Student')) return '/class-setup/student/groups'
      if (is('Lecturer')) return '/class-setup/lecturer/classes'
      return null
    case 'InventoryAudit':
      return notification.refId ? `/class-setup/admin/inventory-audits/${notification.refId}` : '/class-setup/admin/inventory-audits'
    default:
      return null
  }
}
