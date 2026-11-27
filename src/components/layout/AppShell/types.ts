import type { ReactNode } from 'react'

/** Thông tin người dùng hiện tại (lấy từ /api/auth/me qua AuthContext). */
export interface ShellUser {
  name?: string
  email?: string
  roles?: string[]
  roleLabel?: string
  permissions?: string[]
  avatarUrl?: string
  avatarBg?: string
  badgeColor?: string
}

/** Mục điều hướng của Sidebar. */
export interface NavItem {
  label: string
  icon: ReactNode
  path: string
  /** Hiện nếu user có ít nhất một role trong danh sách (rỗng/không có = mọi role). */
  roles?: string[]
  /** Ẩn nếu user có bất kỳ role nào trong danh sách. */
  excludeRoles?: string[]
  /** Nếu có: hiện khi user có ít nhất một permission (ưu tiên hơn roles). */
  permissionCodes?: string[]
  /** Khóa số đếm hiển thị badge, tra trong NavCounts. */
  countKey?: keyof NavCounts
}

export interface NavCounts {
  labNewOrders: number
}

/** Props giữ tương thích với PortalLayout cũ; headerTitle/headerSubtitle không còn được hiển thị. */
export interface AppShellProps {
  children?: ReactNode
  headerTitle?: string
  headerSubtitle?: string
  currentRole?: string
  currentUser?: ShellUser
  activeMenuKey?: string
}

/** Bảng màu dùng chung, đồng bộ với màn hình đăng nhập. */
export const SHELL_COLORS = {
  primary: '#0058be',
  primaryDark: '#0049a3',
  primarySoft: '#eaedff',
  hoverBg: '#f1f5fd',
  focusRing: 'rgba(0, 88, 190, 0.35)',
  text: '#263247',
  textMuted: '#6b7280',
  border: '#e4e6ef',
  pageBg: '#f8fafc',
  white: '#ffffff',
} as const

export const SIDEBAR_WIDTH_EXPANDED = 240
export const SIDEBAR_WIDTH_COLLAPSED = 72
export const TOPBAR_HEIGHT = 56
/** Cao hơn Topbar (10) và vùng nội dung để tooltip/pill không bị che. */
export const TOOLTIP_Z_INDEX = 1500
