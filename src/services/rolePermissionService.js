import api, { extractErrorMessage } from './api'

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
      throw new Error(extractErrorMessage(error, 'Gỡ quyền khỏi vai trò thất bại'), { cause: error })
    }
  },
}
