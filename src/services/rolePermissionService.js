import api, { extractErrorMessage } from './api'
import { MOCK_PERMISSIONS, MOCK_ROLES } from './mockData'

// Bộ nhớ đệm cục bộ cho roles và permissions khi DB chưa kết nối
let localMockRoles = JSON.parse(JSON.stringify(MOCK_ROLES))

export const rolePermissionService = {
  /**
   * Lấy danh sách toàn bộ permissions (theo module)
   * GET /api/permissions
   * Quyền: ROLE_MANAGE (Admin)
   * Trả về (200): PermissionResponse[]
   */
  async getPermissions() {
    try {
      const response = await api.get('/api/permissions')
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || !error.response) {
        console.warn('API /api/permissions gặp lỗi server, sử dụng mock permissions')
        return MOCK_PERMISSIONS
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách quyền hạn'), { cause: error })
    }
  },

  /**
   * Lấy danh sách vai trò (kèm số user và số permission)
   * GET /api/roles
   * Quyền: ROLE_MANAGE (Admin)
   * Trả về (200): RoleItemResponse[]
   */
  async getRoles() {
    try {
      const response = await api.get('/api/roles')
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || !error.response) {
        console.warn('API /api/roles gặp lỗi server, sử dụng mock roles')
        return localMockRoles.map((r) => ({
          roleId: r.roleId,
          roleName: r.roleName,
          description: r.description,
          userCount: r.userCount,
          permissionCount: r.permissions ? r.permissions.length : r.permissionCount,
        }))
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách vai trò'), { cause: error })
    }
  },

  /**
   * Xem chi tiết role kèm danh sách permission
   * GET /api/roles/{id}
   * Quyền: ROLE_MANAGE (Admin)
   * Path: id (guid)
   * Trả về (200): RoleDetailResponse
   */
  async getRoleById(id) {
    try {
      const response = await api.get(`/api/roles/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 404 || !error.response) {
        console.warn(`API /api/roles/${id} gặp lỗi, tìm kiếm trong mock roles`)
        const role = localMockRoles.find((r) => r.roleId === id)
        if (role) {
          return {
            ...role,
            permissionCount: role.permissions.length,
          }
        }
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết vai trò'), { cause: error })
    }
  },

  /**
   * Thêm 1 permission cho role
   * POST /api/roles/{id}/permissions/{code}
   * Quyền: ROLE_MANAGE (Admin)
   * Path: id (guid), code (string)
   * Trả về (200): RoleDetailResponse
   */
  async addPermission(roleId, permissionCode) {
    try {
      const response = await api.post(`/api/roles/${roleId}/permissions/${permissionCode}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || !error.response) {
        console.warn(`API POST /api/roles/${roleId}/permissions/${permissionCode} gặp lỗi, cập nhật trong mock roles`)
        const roleIndex = localMockRoles.findIndex((r) => r.roleId === roleId)
        if (roleIndex !== -1) {
          const perm = MOCK_PERMISSIONS.find((p) => p.permissionCode === permissionCode)
          if (perm && !localMockRoles[roleIndex].permissions.some((p) => p.permissionCode === permissionCode)) {
            localMockRoles[roleIndex].permissions.push(perm)
            localMockRoles[roleIndex].permissionCount = localMockRoles[roleIndex].permissions.length
          }
          return localMockRoles[roleIndex]
        }
      }
      throw new Error(extractErrorMessage(error, 'Thêm quyền cho vai trò thất bại'), { cause: error })
    }
  },

  /**
   * Gỡ 1 permission khỏi role
   * DELETE /api/roles/{id}/permissions/{code}
   * Quyền: ROLE_MANAGE (Admin)
   * Path: id (guid), code (string)
   * Trả về (200): RoleDetailResponse
   */
  async removePermission(roleId, permissionCode) {
    try {
      const response = await api.delete(`/api/roles/${roleId}/permissions/${permissionCode}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || !error.response) {
        console.warn(`API DELETE /api/roles/${roleId}/permissions/${permissionCode} gặp lỗi, cập nhật trong mock roles`)
        const roleIndex = localMockRoles.findIndex((r) => r.roleId === roleId)
        if (roleIndex !== -1) {
          localMockRoles[roleIndex].permissions = localMockRoles[roleIndex].permissions.filter(
            (p) => p.permissionCode !== permissionCode
          )
          localMockRoles[roleIndex].permissionCount = localMockRoles[roleIndex].permissions.length
          return localMockRoles[roleIndex]
        }
      }
      throw new Error(extractErrorMessage(error, 'Gỡ quyền khỏi vai trò thất bại'), { cause: error })
    }
  },
}
