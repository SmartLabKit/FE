/** Nhãn vai trò tiếng Việt, khóa theo mã role viết hoa. */
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  INVENTORYMANAGER: 'Quản lý kho',
  LABSTAFF: 'Nhân viên phòng Lab',
  LECTURER: 'Giảng viên',
  STUDENT: 'Sinh viên',
}

/** Đổi mã role (ADMIN, Admin, LabStaff...) sang nhãn tiếng Việt; role lạ giữ nguyên. */
export function getRoleLabel(role?: string): string {
  if (!role) return ''
  const key = role.replace(/[\s_-]/g, '').toUpperCase()
  return ROLE_LABELS[key] ?? role
}
