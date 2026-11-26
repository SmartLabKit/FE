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
 * refType do BE gửi: BorrowRequest, BorrowApproval, BorrowExtension, Project, Team, Class, InventoryAudit (refId là id tương ứng).
 * Trả về null khi không có trang phù hợp (chỉ đánh dấu đã đọc).
 */
export function getNotificationPath(notification, hasRole) {
  const is = (role) => Boolean(hasRole?.(role))
  switch (notification.refType) {
    case 'BorrowRequest':
      if (is('LabStaff')) return '/borrow/lab-orders'
      return notification.refId ? `/borrow/requests/${notification.refId}` : '/borrow/my-requests'
    case 'BorrowApproval':
    case 'BorrowExtension':
      return '/borrow/my-requests'
    case 'Project':
      if (is('Student')) return '/class-setup/student/project'
      if (is('Lecturer')) return '/class-setup/lecturer/classes'
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
