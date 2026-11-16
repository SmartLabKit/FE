import api, { extractErrorMessage } from './api'
import { academicService } from './academicService'

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

  async getAllProjects(params = { page: 1, size: 100 }) {
    try {
      const response = await api.get('/api/projects', { params })
      const data = unwrap(response)
      return Array.isArray(data) ? data : data?.items || []
    } catch {
      return []
    }
  },

  async getLecturerProjects() {
    let pendingList = []
    try {
      const pData = await projectService.getPendingApprovalProjects()
      pendingList = Array.isArray(pData) ? pData : pData?.items || []
    } catch (e) {
      console.warn('Lỗi tải pending projects:', e)
    }

    let directList = []
    try {
      const direct = await projectService.getAllProjects()
      if (Array.isArray(direct)) {
        directList = direct
      }
    } catch {
      // Bỏ qua nếu không hỗ trợ
    }

    let classProjectsList = []
    try {
      const classesData = await academicService.getMyClasses()
      const myClasses = Array.isArray(classesData) ? classesData : classesData?.items || []
      if (myClasses.length > 0) {
        const classBatches = await Promise.all(
          myClasses.map(async (c) => {
            try {
              const list = await projectService.getProjectsByClass(c.classId)
              return list.map((p) => ({
                ...p,
                classCode: p.classCode || c.classCode,
              }))
            } catch {
              return []
            }
          })
        )
        classProjectsList = classBatches.flat()
      }
    } catch (err) {
      console.warn('Lỗi tải projects theo lớp:', err)
    }

    const projectMap = new Map()
    directList.forEach((p) => {
      if (p?.projectId) projectMap.set(p.projectId, p)
    })
    classProjectsList.forEach((p) => {
      if (p?.projectId) {
        const existing = projectMap.get(p.projectId) || {}
        projectMap.set(p.projectId, { ...existing, ...p })
      }
    })
    pendingList.forEach((p) => {
      if (p?.projectId) {
        const existing = projectMap.get(p.projectId) || {}
        projectMap.set(p.projectId, {
          ...existing,
          ...p,
          status: p.status || 'Submitted',
        })
      }
    })
    return Array.from(projectMap.values())
  },

  async getProjectsByClass(classId) {
    try {
      const response = await api.get('/api/projects', {
        params: { classId, ClassId: classId, page: 1, size: 100 },
      })
      const data = unwrap(response)
      return Array.isArray(data) ? data : data?.items || []
    } catch {
      try {
        const response2 = await api.get(`/api/classes/${classId}/projects`)
        const data2 = unwrap(response2)
        return Array.isArray(data2) ? data2 : data2?.items || []
      } catch (error) {
        throw new Error(extractErrorMessage(error, 'Không thể tải project của lớp'), { cause: error })
      }
    }
  },

  async getProject(projectId) {
    try {
      return unwrap(await api.get(`/api/projects/${projectId}`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải thông tin project'), { cause: error })
    }
  },

  /** @returns {Promise<import('./projectTypes').BorrowDeadlineResponse>} */
  async getBorrowDeadline(projectId) {
    try {
      return unwrap(await api.get(`/api/projects/${projectId}/borrow-deadline`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải hạn trả theo học kỳ'), {
        cause: error,
      })
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

  /** @param {import('./projectTypes').SubmitProjectRequest} data */
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
