import api, { extractErrorMessage } from './api'

function unwrap(response) {
  return response.data?.data ?? response.data
}

export const projectService = {
  async getPendingApprovalProjects(params = { page: 1, size: 100 }) {
    try {
      return unwrap(await api.get('/api/projects/pending-approval', { params }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách project chờ duyệt'), {
        cause: error,
      })
    }
  },

  async getProjectsByClass(classId) {
    try {
      const response = await api.get('/api/projects', {
        params: { classId, page: 1, size: 100 },
      })
      const data = unwrap(response)
      return Array.isArray(data) ? data : data?.items || []
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải project của lớp'), { cause: error })
    }
  },

  async getProject(projectId) {
    try {
      return unwrap(await api.get(`/api/projects/${projectId}`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải thông tin project'), { cause: error })
    }
  },

  async createProject(teamId, data) {
    try {
      return unwrap(await api.post(`/api/teams/${teamId}/project`, data))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tạo project'), { cause: error })
    }
  },

  async updateProject(projectId, data) {
    try {
      return unwrap(await api.put(`/api/projects/${projectId}`, data))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể lưu project'), { cause: error })
    }
  },

  async suggestComponents(description) {
    try {
      return unwrap(await api.post('/api/projects/suggest-components', { description }))
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Bạn đã sử dụng hết lượt AI gợi ý (tối đa 10 lần/giờ). Vui lòng thử lại sau.', {
          cause: error,
        })
      }
      throw new Error(extractErrorMessage(error, 'Không thể lấy gợi ý linh kiện'), { cause: error })
    }
  },

  async submitProject(projectId, data) {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/submit`, data))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể gửi duyệt project'), { cause: error })
    }
  },

  async withdrawProject(projectId) {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/withdraw`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể rút lại project'), { cause: error })
    }
  },

  async approveProject(projectId, comment = '') {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/approve`, { comment }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể duyệt project'), { cause: error })
    }
  },

  async rejectProject(projectId, reason) {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/reject`, { reason }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể từ chối project'), { cause: error })
    }
  },
}
