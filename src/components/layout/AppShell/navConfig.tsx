import {
  Category as CategoryIcon,
  CompareArrows as BorrowReturnIcon,
  AssignmentTurnedIn as ApprovalsIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  School as SchoolIcon,
  Groups as GroupsIcon,
  MenuBook as MenuBookIcon,
  Tune as TuneIcon,
  Dashboard as DashboardIcon,
  Assessment as ReportIcon,
  FactCheck as FinalSubmissionIcon,
  ReportProblem as IssueIcon,
  MeetingRoom as RoomIcon,
  History as AuditLogIcon,
} from '@mui/icons-material'
import type { NavItem, ShellUser } from './types'

/** Danh sách điều hướng đầy đủ; việc ẩn/hiện do filterNavItems quyết định theo role/permission. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan', icon: <DashboardIcon fontSize="small" />, path: '/dashboard', roles: ['Admin', 'InventoryManager', 'LabStaff', 'Lecturer'] },
  { label: 'Báo cáo', icon: <ReportIcon fontSize="small" />, path: '/reports', roles: ['Admin', 'InventoryManager', 'LabStaff', 'Lecturer'] },
  { label: 'Xử lý sự cố', icon: <IssueIcon fontSize="small" />, path: '/issue-reports', roles: ['LabStaff'], excludeRoles: ['Admin'] },
  { label: 'Sự cố thiết bị', icon: <IssueIcon fontSize="small" />, path: '/issue-reports', roles: ['InventoryManager'], excludeRoles: ['Admin', 'LabStaff'] },

  // Sinh viên
  { label: 'Nhóm & Lời mời', icon: <GroupsIcon fontSize="small" />, path: '/class-setup/student/groups', roles: ['Student'] },
  { label: 'Dự án của tôi', icon: <MenuBookIcon fontSize="small" />, path: '/class-setup/student/project', roles: ['Student'] },
  { label: 'Mượn / Trả linh kiện', icon: <BorrowReturnIcon fontSize="small" />, path: '/borrow/my-requests', roles: ['Student'] },

  // Giảng viên
  { label: 'Lớp giảng dạy & nhóm', icon: <GroupsIcon fontSize="small" />, path: '/class-setup/lecturer/classes', roles: ['Lecturer'] },
  { label: 'Duyệt đề tài', icon: <ApprovalsIcon fontSize="small" />, path: '/borrow/my-requests', roles: ['Lecturer'] },
  { label: 'Duyệt nộp cuối kỳ', icon: <FinalSubmissionIcon fontSize="small" />, path: '/class-setup/lecturer/final-submissions', roles: ['Lecturer'], excludeRoles: ['Admin'] },

  // Học vụ (Admin)
  { label: 'Kỳ học & Lớp môn', icon: <SchoolIcon fontSize="small" />, path: '/class-setup/admin/semesters', roles: ['Admin'] },
  { label: 'Danh mục Môn học', icon: <MenuBookIcon fontSize="small" />, path: '/class-setup/admin/courses', roles: ['Admin'] },
  { label: 'Nhập danh sách lớp & phân công', icon: <ApprovalsIcon fontSize="small" />, path: '/class-setup/admin/roster', roles: ['Admin'] },

  // Kho & linh kiện
  { label: 'Quản lý linh kiện', icon: <CategoryIcon fontSize="small" />, path: '/class-setup/admin/components', roles: ['InventoryManager', 'LabStaff'] },
  { label: 'Tra cứu linh kiện', icon: <CategoryIcon fontSize="small" />, path: '/components/catalog', roles: ['InventoryManager', 'LabStaff', 'Lecturer', 'Student'] },
  { label: 'Tủ & kiểm kê', icon: <RoomIcon fontSize="small" />, path: '/class-setup/admin/cabinets', roles: ['InventoryManager', 'LabStaff'] },
  { label: 'Quản lý phòng lab', icon: <RoomIcon fontSize="small" />, path: '/class-setup/admin/lab-room-management', permissionCodes: ['COMPONENT_MANAGE', 'USER_MANAGE'] },
  { label: 'Nhập kho', icon: <ApprovalsIcon fontSize="small" />, path: '/class-setup/admin/stock-receipts', roles: ['InventoryManager'] },
  { label: 'Sổ kho', icon: <AuditLogIcon fontSize="small" />, path: '/class-setup/admin/inventory-ledger', roles: ['InventoryManager'] },

  // Bàn giao & trả đồ
  { label: 'Xử lý đơn mượn', icon: <BorrowReturnIcon fontSize="small" />, path: '/borrow/lab-orders', roles: ['LabStaff'], countKey: 'labNewOrders' },

  // Quản trị hệ thống
  { label: 'Người dùng', icon: <PeopleIcon fontSize="small" />, path: '/admin/users', roles: ['Admin'] },
  { label: 'Vai trò & Quyền', icon: <SecurityIcon fontSize="small" />, path: '/admin/roles', roles: ['Admin'] },
  { label: 'Cài đặt hệ thống', icon: <TuneIcon fontSize="small" />, path: '/admin/system-settings', roles: ['Admin'] },
  { label: 'Nhật ký thao tác', icon: <AuditLogIcon fontSize="small" />, path: '/admin/audit-logs', roles: ['Admin'] },
]

/** Chuẩn hóa danh sách role của user thành chữ hoa để so sánh. */
export function getUserRoles(user: ShellUser): string[] {
  return (user.roles || [user.roleLabel || 'Admin']).map((r) => String(r).toUpperCase())
}

/** Lọc mục điều hướng theo role/permission của user hiện tại. */
export function filterNavItems(
  items: NavItem[],
  user: ShellUser,
  hasPermission: (code: string) => boolean,
): NavItem[] {
  const userRoles = getUserRoles(user)
  const hasRole = (...targets: string[]) => targets.some((r) => userRoles.includes(r.toUpperCase()))

  return items.filter((item) => {
    if (item.excludeRoles?.some((r) => hasRole(r))) return false
    if (item.permissionCodes) return item.permissionCodes.some((p) => hasPermission(p))
    if (!item.roles || item.roles.length === 0) return true
    return item.roles.some((r) => hasRole(r))
  })
}

/**
 * Xác định mục đang active. Một số mục gom nhiều route con nên dùng startsWith;
 * các mục còn lại so khớp chính xác pathname.
 */
export function isNavActive(item: NavItem, pathname: string, activeMenuKey?: string): boolean {
  const starts = (prefix: string) => pathname.startsWith(prefix)

  switch (item.path) {
    case '/admin/users':
      return starts('/admin/users')
    case '/admin/roles':
      return starts('/admin/roles')
    case '/admin/system-settings':
      return starts('/admin/system-settings')
    case '/components/catalog':
      return starts('/components') || pathname === '/class-setup/admin/components/catalog'
    case '/class-setup/admin/components':
      return starts('/class-setup/admin/components') && !pathname.includes('/catalog')
    case '/class-setup/admin/cabinets':
      return (
        starts('/class-setup/admin/categories') ||
        starts('/class-setup/admin/lab-rooms') ||
        starts('/class-setup/admin/cabinets') ||
        starts('/class-setup/admin/inventory-audits')
      )
    case '/class-setup/admin/stock-receipts':
      return starts('/class-setup/admin/stock-receipts') || starts('/class-setup/admin/stock-inwards')
    case '/class-setup/student/project':
      return starts('/class-setup/student/project')
    case '/class-setup/lecturer/classes':
      return starts('/class-setup/lecturer/classes')
    case '/borrow/my-requests':
      return starts('/borrow') || activeMenuKey === 'borrow' || activeMenuKey === 'handover'
    default:
      return pathname === item.path
  }
}
