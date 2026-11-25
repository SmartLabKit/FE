import api, { extractErrorMessage, unwrapApiResponse } from './api'

function unwrap(response, defaultErrorMsg) {
  return unwrapApiResponse(response, defaultErrorMsg)
}

async function getProjectPage(params) {
  return unwrap(
    await api.get('/api/projects', { params }),
    'Không thể tải danh sách dự án của bạn.'
  )
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
      const data = await getProjectPage(params)
      return Array.isArray(data) ? data : data?.items || []
    } catch {
      return []
    }
  },

  async getMyProjects() {
    const size = 100
    const projects = []
    try {
      // API lọc dự án theo tài khoản đăng nhập. Đọc hết phân trang trước khi kết luận nhóm chưa có dự án.
      for (let page = 1; ; page++) {
        const result = await getProjectPage({ page, size })
        if (result == null) return projects
        const items = Array.isArray(result) ? result : result?.items
        if (!Array.isArray(items)) throw new Error('Không nhận được danh sách dự án hợp lệ.')
        projects.push(...items)

        if (Array.isArray(result) || items.length === 0) return projects
        const totalPages = result.totalPages ?? Math.ceil((result.totalCount ?? items.length) / (result.pageSize || size))
        if (page >= totalPages) return projects
      }
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách dự án của bạn.'), { cause: error })
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

    // GET /api/projects đã trả đủ đề tài các lớp giảng viên phụ trách, không cần gọi thêm theo từng lớp
    const projectMap = new Map()
    directList.forEach((p) => {
      if (p?.projectId) projectMap.set(p.projectId, p)
    })
    pendingList.forEach((p) => {
      if (p?.projectId) {
        const existing = projectMap.get(p.projectId) || {}
        const isSupp = Boolean(p.isSupplementary)
        projectMap.set(p.projectId, {
          ...existing,
          ...p,
          // Với đơn mượn thêm, project vẫn ở trạng thái Approved nhưng có đơn bổ sung chờ duyệt
          status: existing.status || (isSupp ? 'Approved' : p.status || 'Submitted'),
          hasPendingApproval: true,
          isSupplementary: isSupp,
          pendingBorrowRequestId: p.borrowRequestId || null,
          pendingRequestCode: p.requestCode || null,
          pendingPurpose: p.purpose || '',
          pendingComponentCount: p.componentCount ?? null,
        })
      }
    })
    return Array.from(projectMap.values())
  },

  async getProjectsByClass(classId) {
    try {
      const data = await getProjectPage({ classId, page: 1, size: 100 })
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

  async suggestComponents(description, classId = null) {
    try {
      return unwrap(await api.post('/api/projects/suggest-components', { description, classId: classId || null }))
    } catch (error) {
      if (error.response?.status === 429) {
        const message = extractErrorMessage(
          error,
          'Bạn đã sử dụng hết lượt AI gợi ý (tối đa 10 lần/giờ). Vui lòng thử lại sau.'
        )
        throw new Error(message, { cause: error })
      }
      throw new Error(extractErrorMessage(error, 'Không thể lấy gợi ý linh kiện'), { cause: error })
    }
  },

  async submitProject(projectId) {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/submit`, {}, {
        headers: { 'Content-Type': 'application/json' },
      }))
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

  async approveProject(projectId, comment = '', adjustments = []) {
    try {
      return unwrap(await api.post(`/api/projects/${projectId}/approve`, { comment: comment || null, adjustments }))
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
