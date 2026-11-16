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

  /**
   * Nhóm trưởng cập nhật link GitHub, slide, video demo
   * PUT /api/projects/{id}/links
   * Body: { githubUrl?, slideUrl?, demoVideoUrl? }
   * Trả về (200): ProjectDetailResponse
   */
  async updateProjectLinks(projectId, data) {
    try {
      return unwrap(await api.put(`/api/projects/${projectId}/links`, data))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể cập nhật link project'), { cause: error })
    }
  },

  /**
   * Nhóm trưởng tải file báo cáo PDF (tối đa 10 MB), thay file cũ nếu có
   * PUT /api/projects/{id}/report
   * Body (multipart/form-data): file
   * Trả về (200): ProjectDetailResponse
   */
  async uploadProjectReport(projectId, file) {
    try {
      return unwrap(await api.put(`/api/projects/${projectId}/report`, toFileForm(file), multipartConfig))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải lên file báo cáo'), { cause: error })
    }
  },

  /**
   * Nhóm trưởng xóa file báo cáo
   * DELETE /api/projects/{id}/report
   * Trả về (200): ProjectDetailResponse
   */
  async deleteProjectReport(projectId) {
    try {
      return unwrap(await api.delete(`/api/projects/${projectId}/report`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể xóa file báo cáo'), { cause: error })
    }
  },

  /**
   * Nhóm trưởng tải mã nguồn dạng ZIP (tối đa 10 MB, không bắt buộc), thay file cũ nếu có
   * PUT /api/projects/{id}/source-code
   * Body (multipart/form-data): file
   * Trả về (200): ProjectDetailResponse
   */
  async uploadProjectSourceCode(projectId, file) {
    try {
      return unwrap(await api.put(`/api/projects/${projectId}/source-code`, toFileForm(file), multipartConfig))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải lên mã nguồn'), { cause: error })
    }
  },

  /**
   * Nhóm trưởng xóa file mã nguồn
   * DELETE /api/projects/{id}/source-code
   * Trả về (200): ProjectDetailResponse
   */
  async deleteProjectSourceCode(projectId) {
    try {
      return unwrap(await api.delete(`/api/projects/${projectId}/source-code`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể xóa file mã nguồn'), { cause: error })
    }
  },

  /**
   * Nhóm trưởng nộp bài cuối: project phải Approved, đủ 3 link và đã có file báo cáo PDF
   * POST /api/projects/{id}/final-submission
   * Trả về (200): ProjectDetailResponse (finalStatus = Pending)
   */
  async submitFinal(projectId) {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/final-submission`))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể nộp bài cuối kỳ'), { cause: error })
    }
  },

  /**
   * Bài nộp cuối đang chờ xác nhận (giảng viên: các lớp mình dạy, Admin: tất cả), nộp sớm nhất lên trước
   * GET /api/projects/final-submissions
   * Query: { search?, classId?, page?, size? }
   * Trả về (200): PagedResult<PendingFinalSubmissionResponse>
   */
  async getFinalSubmissions(params = { page: 1, size: 20 }) {
    try {
      return unwrap(await api.get('/api/projects/final-submissions', { params }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách bài nộp cuối kỳ'), { cause: error })
    }
  },

  /**
   * Giảng viên xác nhận bài nộp cuối, nhận xét không bắt buộc
   * POST /api/projects/{id}/final-submission/approve
   * Body: { comment? }
   * Trả về (200): ProjectDetailResponse
   */
  async approveFinal(projectId, comment = '') {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/final-submission/approve`, { comment: comment.trim() || null }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể xác nhận bài nộp'), { cause: error })
    }
  },

  /**
   * Giảng viên trả bài, bắt buộc ghi nhận xét để nhóm sửa và nộp lại
   * POST /api/projects/{id}/final-submission/reject
   * Body: { comment }
   * Trả về (200): ProjectDetailResponse
   */
  async rejectFinal(projectId, comment) {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/final-submission/reject`, { comment: comment.trim() }))
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể trả bài nộp'), { cause: error })
    }
  },
}

const multipartConfig = { headers: { 'Content-Type': 'multipart/form-data' } }

function toFileForm(file) {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}
