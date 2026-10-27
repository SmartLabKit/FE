/**
 * mockData.js: Dữ liệu giả định phong phú theo chuẩn DTO Backend
 * Dùng làm fallback khi backend database chưa kết nối hoặc đang offline
 */

export const MOCK_PERMISSIONS = [
  // Module Identity
  {
    permissionId: 'p-101',
    permissionCode: 'USER_VIEW',
    permissionName: 'Xem danh sách và chi tiết người dùng',
    module: 'Identity',
  },
  {
    permissionId: 'p-102',
    permissionCode: 'USER_MANAGE',
    permissionName: 'Tạo, sửa thông tin và phân quyền người dùng',
    module: 'Identity',
  },
  {
    permissionId: 'p-103',
    permissionCode: 'ROLE_MANAGE',
    permissionName: 'Quản lý vai trò và phân bổ quyền hạn',
    module: 'Identity',
  },

  // Module Academic
  {
    permissionId: 'p-201',
    permissionCode: 'SEMESTER_MANAGE',
    permissionName: 'Quản lý học kỳ và thời gian biểu',
    module: 'Academic',
  },
  {
    permissionId: 'p-202',
    permissionCode: 'CLASS_MANAGE',
    permissionName: 'Quản lý lớp học phần và giảng viên phụ trách',
    module: 'Academic',
  },
  {
    permissionId: 'p-203',
    permissionCode: 'ROSTER_IMPORT',
    permissionName: 'Nhập danh sách sinh viên theo lớp',
    module: 'Academic',
  },
  {
    permissionId: 'p-204',
    permissionCode: 'PROJECT_APPROVE',
    permissionName: 'Phê duyệt đề tài và danh mục thiết bị của nhóm',
    module: 'Academic',
  },

  // Module Inventory
  {
    permissionId: 'p-301',
    permissionCode: 'COMPONENT_VIEW',
    permissionName: 'Tra cứu danh mục linh kiện và tồn kho',
    module: 'Inventory',
  },
  {
    permissionId: 'p-302',
    permissionCode: 'COMPONENT_MANAGE',
    permissionName: 'Thêm, sửa thông tin linh kiện và quy chuẩn',
    module: 'Inventory',
  },
  {
    permissionId: 'p-303',
    permissionCode: 'STOCK_INWARD',
    permissionName: 'Tạo phiếu nhập kho và định vị ngăn tủ',
    module: 'Inventory',
  },
  {
    permissionId: 'p-304',
    permissionCode: 'STORAGE_MANAGE',
    permissionName: 'Quản lý tủ, phòng lab và sơ đồ vị trí lưu trữ',
    module: 'Inventory',
  },

  // Module Borrowing
  {
    permissionId: 'p-401',
    permissionCode: 'BORROW_REQUEST',
    permissionName: 'Tạo và gửi yêu cầu mượn linh kiện / kit',
    module: 'Borrowing',
  },
  {
    permissionId: 'p-402',
    permissionCode: 'BORROW_APPROVE',
    permissionName: 'Duyệt yêu cầu mượn thiết bị của sinh viên',
    module: 'Borrowing',
  },
  {
    permissionId: 'p-403',
    permissionCode: 'BORROW_ISSUE',
    permissionName: 'Bàn giao thiết bị thực tế theo mã QR',
    module: 'Borrowing',
  },
  {
    permissionId: 'p-404',
    permissionCode: 'BORROW_RETURN',
    permissionName: 'Xác nhận hoàn trả, kiểm tra tình trạng hỏng hóc',
    module: 'Borrowing',
  },

  // Module Reports & Audits
  {
    permissionId: 'p-501',
    permissionCode: 'AUDIT_MANAGE',
    permissionName: 'Tạo và thực hiện kỳ kiểm kê phòng lab',
    module: 'Audit',
  },
  {
    permissionId: 'p-502',
    permissionCode: 'REPORT_VIEW',
    permissionName: 'Xem báo cáo định mức, tổn thất và tần suất sử dụng',
    module: 'Reports',
  },
]

export const MOCK_ROLES = [
  {
    roleId: 'r-001',
    roleName: 'Admin',
    description: 'Quản trị viên toàn quyền cấu hình hệ thống, tài khoản và phân quyền',
    userCount: 2,
    permissionCount: 16,
    permissions: [...MOCK_PERMISSIONS],
  },
  {
    roleId: 'r-002',
    roleName: 'LabStaff',
    description: 'Nhân viên quản lý phòng thực hành, xuất nhập kho và bàn giao thiết bị',
    userCount: 4,
    permissionCount: 8,
    permissions: MOCK_PERMISSIONS.filter((p) =>
      ['COMPONENT_VIEW', 'STOCK_INWARD', 'STORAGE_MANAGE', 'BORROW_ISSUE', 'BORROW_RETURN', 'AUDIT_MANAGE', 'REPORT_VIEW'].includes(
        p.permissionCode
      )
    ),
  },
  {
    roleId: 'r-003',
    roleName: 'InventoryManager',
    description: 'Cán bộ thủ kho, chịu trách nhiệm nhập số lượng và kiểm kê định kỳ',
    userCount: 3,
    permissionCount: 7,
    permissions: MOCK_PERMISSIONS.filter((p) =>
      ['COMPONENT_VIEW', 'COMPONENT_MANAGE', 'STOCK_INWARD', 'STORAGE_MANAGE', 'AUDIT_MANAGE', 'REPORT_VIEW'].includes(
        p.permissionCode
      )
    ),
  },
  {
    roleId: 'r-004',
    roleName: 'Lecturer',
    description: 'Giảng viên phụ trách môn học, phê duyệt đề tài và định mức linh kiện',
    userCount: 8,
    permissionCount: 5,
    permissions: MOCK_PERMISSIONS.filter((p) =>
      ['COMPONENT_VIEW', 'CLASS_MANAGE', 'PROJECT_APPROVE', 'BORROW_APPROVE', 'REPORT_VIEW'].includes(
        p.permissionCode
      )
    ),
  },
  {
    roleId: 'r-005',
    roleName: 'Student',
    description: 'Sinh viên tham gia lớp học, đăng ký đề tài và mượn trả kit linh kiện',
    userCount: 45,
    permissionCount: 2,
    permissions: MOCK_PERMISSIONS.filter((p) =>
      ['COMPONENT_VIEW', 'BORROW_REQUEST'].includes(p.permissionCode)
    ),
  },
]

export const MOCK_USERS = [
  {
    userId: 'u-001',
    username: 'admin',
    email: 'admin@smartlabkit.vn',
    fullName: 'Nguyễn Văn Minh',
    phoneNumber: '0901234567',
    avatarUrl: '',
    isActive: true,
    lastLoginAt: '2026-10-27T18:40:00Z',
    createdAt: '2026-09-01T08:00:00Z',
    roles: ['Admin'],
  },
  {
    userId: 'u-002',
    username: 'labstaff_anh',
    email: 'staff.anh@smartlabkit.vn',
    fullName: 'Trần Tuấn Anh',
    phoneNumber: '0912345678',
    avatarUrl: '',
    isActive: true,
    lastLoginAt: '2026-10-27T14:15:00Z',
    createdAt: '2026-09-02T09:30:00Z',
    roles: ['LabStaff'],
  },
  {
    userId: 'u-003',
    username: 'inv_lan',
    email: 'lan.inventory@smartlabkit.vn',
    fullName: 'Võ Thị Mai Lan',
    phoneNumber: '0923456789',
    avatarUrl: '',
    isActive: true,
    lastLoginAt: '2026-10-26T16:20:00Z',
    createdAt: '2026-09-05T10:00:00Z',
    roles: ['InventoryManager'],
  },
  {
    userId: 'u-004',
    username: 'dr_stone',
    email: 'lecturer@smartlabkit.vn',
    fullName: 'Dr. Evelyn Stone',
    phoneNumber: '0934567890',
    avatarUrl: '',
    isActive: true,
    lastLoginAt: '2026-10-27T08:10:00Z',
    createdAt: '2026-09-03T11:00:00Z',
    roles: ['Lecturer'],
    instructorProfile: {
      instructorCode: 'INS089',
      academicTitle: 'Tiến sĩ',
    },
  },
  {
    userId: 'u-005',
    username: 'sv_namlh',
    email: 'student@smartlabkit.vn',
    fullName: 'Lê Hoàng Nam',
    phoneNumber: '0945678901',
    avatarUrl: '',
    isActive: true,
    lastLoginAt: '2026-10-27T17:50:00Z',
    createdAt: '2026-09-10T14:00:00Z',
    roles: ['Student'],
    studentProfile: {
      studentCode: 'SE160245',
      major: 'Kỹ thuật Phần mềm',
      cohort: 'K16',
    },
  },
  {
    userId: 'u-006',
    username: 'sv_phuocpt',
    email: 'phuocpt@fpt.edu.vn',
    fullName: 'Phạm Tấn Phước',
    phoneNumber: '0956789012',
    avatarUrl: '',
    isActive: false,
    lastLoginAt: null,
    createdAt: '2026-10-15T09:00:00Z',
    roles: ['Student'],
    studentProfile: {
      studentCode: 'SE160899',
      major: 'IoT & Phần cứng nhúng',
      cohort: 'K16',
    },
  },
]
