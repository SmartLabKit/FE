import api, { extractErrorMessage } from './api'
import { academicService } from './academicService'
import { teamService } from './teamService'
import { projectService } from './projectService'

// Hằng số rỗng tương thích ngược cho các màn hình mượn trả (không chứa mock data)
export const MOCK_SUPPLEMENTARY_REQUESTS = []
export const MOCK_AVAILABLE_COMPONENTS = []
export const MOCK_ORIGINAL_BORROWS = []
export const MOCK_RETURN_REQUESTS = []
export const MOCK_BORROW_EXTENSIONS = []

function extractPagedItems(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.Items)) return data.Items
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.data?.items)) return data.data.items
  if (Array.isArray(data.data?.Items)) return data.data.Items
  return []
}

export const borrowService = {
  // ===================== 1. ĐƠN MƯỢN CỦA TÔI & CHI TIẾT ĐƠN =====================

  /**
   * Đơn mượn của tôi: đơn mình gửi và đơn của nhóm mình. Mới nhất lên trước.
   * GET /api/borrow-requests/my
   * Quyền: Đăng nhập
   * Query: Search (string), Status (string), Overdue (bool), Page (int), Size (int)
   * Trả về (200): PagedResult
   */
  async getMyBorrowRequests(params = {}) {
    try {
      const mergedParams = { page: 1, size: 100, ...params }
      const response = await api.get('/api/borrow-requests/my', { params: mergedParams })
      return response.data?.data ?? response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách đơn mượn của bạn'), { cause: error })
    }
  },

  /**
   * Đơn mượn của các lớp giảng viên phụ trách (chỉ để theo dõi), nạp đủ các trang.
   * GET /api/borrow-requests/teaching
   * Quyền: Lecturer, Admin
   */
  async getTeachingBorrowRequests() {
    try {
      const fetchPage = (page) =>
        api.get('/api/borrow-requests/teaching', { params: { page, size: 100 } }).then((res) => res.data?.data ?? res.data)
      const firstPage = await fetchPage(1)
      const items = [...extractPagedItems(firstPage)]
      const totalPages = Math.min(Number(firstPage?.totalPages || 1), 10)
      for (let page = 2; page <= totalPages; page += 1) {
        items.push(...extractPagedItems(await fetchPage(page)))
      }
      return items
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải đơn mượn của lớp'), { cause: error })
    }
  },

  /**
   * Lấy toàn bộ đơn mượn của sinh viên (tự động nạp đủ các trang từ /api/borrow-requests/my
   * và bổ sung đối chiếu với danh sách đơn gắn trên các đề tài của nhóm).
   */
  async getAllMyBorrowRequests() {
    const overview = await this.getStudentBorrowOverview({ includeExtensions: false })
    return overview.borrowRequests
  },

  /**
   * Tổng hợp đầy đủ dữ liệu đơn mượn, phiếu mượn bổ sung và yêu cầu gia hạn cho sinh viên.
   */
  async getStudentBorrowOverview({ includeExtensions = true } = {}) {
    let myBorrowsError = ''
    let directItems = []

    // 1. Lấy từ GET /api/borrow-requests/my (có phân trang đầy đủ)
    const fetchDirectPromise = (async () => {
      try {
        const firstPage = await this.getMyBorrowRequests({ page: 1, size: 100 })
        const items = [...extractPagedItems(firstPage)]
        const totalPages = Number(firstPage?.totalPages || 1)
        if (totalPages > 1) {
          const maxPages = Math.min(totalPages, 10)
          const rest = await Promise.all(
            Array.from({ length: maxPages - 1 }, (_, idx) =>
              this.getMyBorrowRequests({ page: idx + 2, size: 100 })
                .then((res) => extractPagedItems(res))
                .catch(() => [])
            )
          )
          rest.forEach((batch) => items.push(...batch))
        }
        directItems = items
      } catch (err) {
        myBorrowsError = err?.message || 'Không thể tải danh sách đơn mượn của bạn.'
      }
    })()

    // 2. Lấy thêm thông tin từ các đề tài của nhóm sinh viên (bổ sung purpose/teamName và dự phòng khi /my thiếu)
    let projectDetails = []
    const fetchProjectBorrowsPromise = (async () => {
      try {
        const classesRes = await academicService.getMyClasses()
        const classes = extractPagedItems(classesRes)
        if (classes.length === 0) return

        const classTeams = await Promise.all(
          classes.map(async (cls) => {
            try {
              const team = await teamService.getMyTeam(cls.classId)
              return team ? { cls, team } : null
            } catch {
              return null
            }
          })
        )
        const validTeams = classTeams.filter(Boolean)
        if (validTeams.length === 0) return

        const details = await Promise.all(
          validTeams.map(async ({ cls, team }) => {
            try {
              const projects = await projectService.getProjectsByClass(cls.classId)
              const teamProjects = (Array.isArray(projects) ? projects : []).filter(
                (p) => p.teamId === team.teamId
              )
              const fullProjects = await Promise.all(
                teamProjects.map(async (p) => {
                  try {
                    const detail = await projectService.getProject(p.projectId)
                    return {
                      ...detail,
                      classCode: detail.classCode || cls.classCode || team.classCode,
                      teamName: detail.teamName || team.teamName,
                    }
                  } catch {
                    return null
                  }
                })
              )
              return fullProjects.filter(Boolean)
            } catch {
              return []
            }
          })
        )
        projectDetails = details.flat()
      } catch {
        // Không làm gián đoạn luồng chính nếu không lấy được danh sách lớp/nhóm
      }
    })()

    await Promise.all([fetchDirectPromise, fetchProjectBorrowsPromise])

    // 3. Hợp nhất dữ liệu theo borrowRequestId (ưu tiên dữ liệu từ /api/borrow-requests/my)
    const requestMap = new Map()
    directItems.forEach((item) => {
      const id = item?.borrowRequestId || item?.id
      if (id) requestMap.set(id, { ...item, borrowRequestId: id })
    })

    projectDetails.forEach((proj) => {
      const projBorrows = Array.isArray(proj?.borrowRequests) ? proj.borrowRequests : []
      projBorrows.forEach((br) => {
        const id = br?.borrowRequestId || br?.id
        if (!id) return
        const existing = requestMap.get(id)
        if (existing) {
          requestMap.set(id, {
            ...br,
            ...existing,
            borrowRequestId: id,
            projectId: existing.projectId || proj.projectId,
            projectTitle: existing.projectTitle || proj.title,
            classCode: existing.classCode || proj.classCode,
            teamName: existing.teamName || proj.teamName,
            purpose: existing.purpose || br.purpose,
            rejectReason: existing.rejectReason || br.rejectReason,
          })
        } else {
          requestMap.set(id, {
            ...br,
            borrowRequestId: id,
            projectId: proj.projectId,
            projectTitle: proj.title,
            classId: proj.classId,
            classCode: proj.classCode,
            teamName: proj.teamName,
            requesterName: proj.ownerName,
            itemCount: br.itemCount ?? proj.componentCount ?? 0,
          })
        }
      })
    })

    const borrowRequests = Array.from(requestMap.values()).sort((a, b) => {
      const timeA = a.requestDate ? new Date(a.requestDate).getTime() : 0
      const timeB = b.requestDate ? new Date(b.requestDate).getTime() : 0
      return timeB - timeA
    })

    // 4. Phân tách danh sách phiếu mượn bổ sung (MF5.1) từ dữ liệu thật
    const byProject = new Map()
    borrowRequests.forEach((br) => {
      if (!br.projectId) return
      const arr = byProject.get(br.projectId) || []
      arr.push(br)
      byProject.set(br.projectId, arr)
    })

    const supplementaryMap = new Map()
    byProject.forEach((list) => {
      if (list.length < 2) return
      const chronological = [...list].sort((a, b) => {
        const tA = a.requestDate ? new Date(a.requestDate).getTime() : 0
        const tB = b.requestDate ? new Date(b.requestDate).getTime() : 0
        return tA - tB
      })
      const originalCode = chronological[0]?.requestCode || '—'
      chronological.slice(1).forEach((supp) => {
        supplementaryMap.set(supp.borrowRequestId, {
          ...supp,
          originalBorrowCode: originalCode,
        })
      })
    })

    borrowRequests.forEach((br) => {
      const purpose = String(br.purpose || '').toLowerCase()
      if (
        (purpose.includes('bổ sung') || purpose.includes('bo sung') || purpose.includes('supplementary')) &&
        !supplementaryMap.has(br.borrowRequestId)
      ) {
        const sameProj = byProject.get(br.projectId) || []
        const oldest = [...sameProj].sort(
          (a, b) => new Date(a.requestDate || 0).getTime() - new Date(b.requestDate || 0).getTime()
        )[0]
        supplementaryMap.set(br.borrowRequestId, {
          ...br,
          originalBorrowCode: oldest && oldest.borrowRequestId !== br.borrowRequestId ? oldest.requestCode : '—',
        })
      }
    })

    const supplementaryRequests = Array.from(supplementaryMap.values()).sort(
      (a, b) => new Date(b.requestDate || 0).getTime() - new Date(a.requestDate || 0).getTime()
    )

    // 5. Trích xuất yêu cầu gia hạn từ chi tiết các đơn mượn của sinh viên (vì GET /api/borrow-extensions chỉ dành cho GV/Lab)
    let extensions = []
    if (includeExtensions && borrowRequests.length > 0) {
      const candidates = borrowRequests
        .filter((br) => ['Borrowing', 'Overdue', 'Returned', 'Ready', 'Approved'].includes(br.status))
        .slice(0, 15)
      const detailResults = await Promise.all(
        candidates.map((br) =>
          this.getBorrowRequestById(br.borrowRequestId)
            .then((detail) => ({ br, detail }))
            .catch(() => null)
        )
      )
      const extMap = new Map()
      detailResults.filter(Boolean).forEach(({ br, detail }) => {
        const list = Array.isArray(detail?.extensions) ? detail.extensions : []
        list.forEach((ext) => {
          const extId = ext.extensionId || `${br.borrowRequestId}-${ext.createdAt}`
          extMap.set(extId, {
            ...ext,
            extensionId: extId,
            borrowRequestId: ext.borrowRequestId || br.borrowRequestId,
            requestCode: ext.requestCode || br.requestCode,
            projectTitle: ext.projectTitle || br.projectTitle,
            requesterName: ext.requesterName || br.requesterName,
            classCode: ext.classCode || br.classCode,
          })
        })
      })
      extensions = Array.from(extMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
    }

    return {
      borrowRequests,
      supplementaryRequests,
      extensions,
      projects: projectDetails,
      error: borrowRequests.length === 0 ? myBorrowsError : '',
    }
  },

  /**
   * Danh sách đơn cho nhân viên lab: đơn thuộc lab mình phụ trách (Admin thấy tất cả).
   * GET /api/borrow-requests
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Query: Search (string), Status (string), Overdue (bool), Page (int), Size (int)
   * Trả về (200): PagedResult
   * Lỗi có thể gặp: 403
   */
  async getLabBorrowRequests(params = {}) {
    try {
      const response = await api.get('/api/borrow-requests', { params })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Bạn không có quyền xem danh sách đơn Lab (Yêu cầu LabStaff hoặc Admin).', { cause: error })
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách đơn mượn Lab'), { cause: error })
    }
  },

  /**
   * Chi tiết đơn: các dòng linh kiện, ảnh giao/trả, lịch sử duyệt
   * GET /api/borrow-requests/{id}
   * Quyền: Đăng nhập
   * Path: id (guid)
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 403, 404
   */
  async getBorrowRequestById(id) {
    try {
      const response = await api.get(`/api/borrow-requests/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết đơn mượn'), { cause: error })
    }
  },

  // ===================== 2. GIA HẠN ĐƠN MƯỢN (EXTENSIONS) =====================

  /**
   * Nhóm trưởng xin gia hạn đơn đang mượn, phải xin trước khi quá hạn
   * POST /api/borrow-requests/{id}/extensions
   * Quyền: BORROW_CREATE (Admin, Student)
   * Path: id (guid)
   * Body (JSON): RequestExtensionRequest { requestedDays: int, reason: string }
   * Trả về (201): BorrowExtensionResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async requestExtension(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/extensions`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xin gia hạn đơn thất bại'), { cause: error })
    }
  },

  /**
   * Danh sách yêu cầu gia hạn cho giảng viên (Admin thấy tất cả)
   * GET /api/borrow-extensions
   * Quyền: BORROW_APPROVE (Admin, LabStaff, Lecturer)
   * Query: Search (string), Status (string), Page (int), Size (int)
   * Trả về (200): PagedResult
   */
  async getBorrowExtensions(params = {}) {
    try {
      const mergedParams = { page: 1, size: 100, ...params }
      const response = await api.get('/api/borrow-extensions', { params: mergedParams })
      return response.data?.data ?? response.data
    } catch (error) {
      if (error.response?.status === 403) {
        return { items: [], total: 0 }
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách yêu cầu gia hạn'), { cause: error })
    }
  },

  /**
   * Giảng viên duyệt gia hạn: hạn trả của đơn đổi sang ngày mới
   * POST /api/borrow-extensions/{extensionId}/approve
   * Quyền: BORROW_APPROVE (Admin, LabStaff, Lecturer)
   * Path: extensionId (guid)
   * Body (JSON): ApproveExtensionRequest { comment?: string }
   * Trả về (200): BorrowExtensionResponse
   * Lỗi có thể gặp: 403, 404, 409
   */
  async approveExtension(extensionId, data = {}) {
    try {
      const response = await api.post(`/api/borrow-extensions/${extensionId}/approve`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Duyệt gia hạn thất bại'), { cause: error })
    }
  },

  /**
   * Giảng viên từ chối gia hạn, bắt buộc ghi lý do (gửi mail cho sinh viên)
   * POST /api/borrow-extensions/{extensionId}/reject
   * Quyền: BORROW_APPROVE (Admin, LabStaff, Lecturer)
   * Path: extensionId (guid)
   * Body (JSON): RejectExtensionRequest { reason: string }
   * Trả về (200): BorrowExtensionResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async rejectExtension(extensionId, data) {
    try {
      const response = await api.post(`/api/borrow-extensions/${extensionId}/reject`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Từ chối gia hạn thất bại'), { cause: error })
    }
  },

  // ===================== 3. BÀN GIAO & ẢNH AI (ISSUE, PHOTOS) =====================

  /**
   * Lab nhận xác nhận đã đủ đồ và hẹn ngày sinh viên đến nhận (yyyy-mm-dd)
   * POST /api/borrow-requests/{id}/lab-accept
   */
  async labAcceptBorrowRequest(id, pickupDate) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/lab-accept`, { pickupDate })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Chấp nhận đơn mượn thất bại'), { cause: error })
    }
  },

  /**
   * Lab đổi ngày hẹn nhận khi đơn chưa giao
   * PUT /api/borrow-requests/{id}/pickup-date
   */
  async changePickupDate(id, pickupDate) {
    try {
      const response = await api.put(`/api/borrow-requests/${id}/pickup-date`, { pickupDate })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Đổi ngày hẹn nhận thất bại'), { cause: error })
    }
  },

  /**
   * Tải ảnh giao linh kiện (photoType = Issue) hoặc ảnh nhận trả (Return): AI đọc MSSV trên thẻ sinh viên
   * POST /api/borrow-requests/{id}/photos
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (form): File (file), PhotoType (string: 'Issue' | 'Return')
   * Trả về (201): HandoverPhotoResponse { photoUrl, aiResult: 'Match' | 'Mismatch' | 'Unreadable', detectedStudentCode }
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async uploadHandoverPhoto(id, file, photoType = 'Issue') {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('photoType', photoType)

      const response = await api.post(`/api/borrow-requests/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tải ảnh bàn giao thất bại'), { cause: error })
    }
  },

  /**
   * Nhận diện thẻ sinh viên từ ảnh chụp/tải lên
   * POST /api/borrow-requests/read-student-card
   */
  async readStudentCard(file) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/api/borrow-requests/read-student-card', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể nhận diện thẻ sinh viên.'), { cause: error })
    }
  },

  /**
   * Giao linh kiện cho sinh viên (Ready → Borrowing)
   * POST /api/borrow-requests/{id}/issue
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): IssueBorrowRequest
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async issueBorrowRequest(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/issue`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Bàn giao linh kiện thất bại'), { cause: error })
    }
  },

  /**
   * Nhận trả tại lab nhận linh kiện (trả được nhiều lần)
   * POST /api/borrow-requests/{id}/return
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): ReturnBorrowRequest
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async returnBorrowRequest(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/return`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tiếp nhận trả linh kiện thất bại'), { cause: error })
    }
  },

  // ===================== 4. LINH KIỆN THAY THẾ & HỦY ĐƠN (REPLACEMENTS & CANCEL) =====================

  /**
   * Giao con thay thế cho sinh viên (dòng Pending của đơn đang mượn, thêm khi ghi nhận sự cố kèm đổi con khác)
   * POST /api/borrow-requests/{id}/replacements/issue
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): IssueReplacementRequest { borrowItemId, itemId, photoId, overrideReason? }
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async issueReplacement(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/replacements/issue`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Giao món thay thế thất bại'), { cause: error })
    }
  },

  /**
   * Hủy món thay thế chưa giao (ghi rõ lý do để gửi mail)
   * POST /api/borrow-requests/{id}/replacements/cancel
   * Quyền: BORROW_ISSUE (Admin, LabStaff)
   * Path: id (guid)
   * Body (JSON): CancelReplacementRequest { borrowItemId, reason: string }
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async cancelReplacement(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/replacements/cancel`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Hủy món thay thế thất bại'), { cause: error })
    }
  },

  /**
   * Hủy đơn đã duyệt mà chưa giao linh kiện (Approved / Ready)
   * POST /api/borrow-requests/{id}/cancel
   * Quyền: Đăng nhập
   * Path: id (guid)
   * Body (JSON): CancelBorrowRequest { reason: string }
   * Trả về (200): BorrowRequestDetailResponse
   * Lỗi có thể gặp: 400, 403, 404, 409
   */
  async cancelBorrowRequest(id, data) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/cancel`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Hủy đơn mượn thất bại'), { cause: error })
    }
  },

  // ===================== 5. MƯỢN BỔ SUNG (MF5.1) & TRẢ LINH KIỆN (MF5.2) =====================

  async getAvailableComponents(search = '') {
    try {
      const response = await api.get('/api/components', {
        params: {
          search: search?.trim() || undefined,
          keptByLab: true,
          isActive: true,
          page: 1,
          size: 100,
        },
      })
      return extractPagedItems(response.data?.data ?? response.data)
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách linh kiện'), { cause: error })
    }
  },

  /**
   * Lấy danh sách các đề tài của nhóm sinh viên đã được duyệt (Approved) để tạo phiếu mượn thêm (MF5.1).
   */
  async getStudentApprovedProjects() {
    const classesRes = await academicService.getMyClasses()
    const classes = extractPagedItems(classesRes)
    if (classes.length === 0) return []

    const classTeams = await Promise.all(
      classes.map(async (cls) => {
        try {
          const team = await teamService.getMyTeam(cls.classId)
          return team ? { cls, team } : null
        } catch {
          return null
        }
      })
    )
    const validTeams = classTeams.filter(Boolean)
    if (validTeams.length === 0) return []

    const projectLists = await Promise.all(
      validTeams.map(async ({ cls, team }) => {
        try {
          const projects = await projectService.getProjectsByClass(cls.classId)
          const teamProjects = (Array.isArray(projects) ? projects : []).filter(
            (p) => p.teamId === team.teamId && p.status === 'Approved'
          )
          const details = await Promise.all(
            teamProjects.map(async (p) => {
              try {
                const detail = await projectService.getProject(p.projectId)
                return {
                  ...detail,
                  classCode: detail.classCode || cls.classCode || team.classCode,
                  courseName: cls.courseName || '',
                  semesterCode: cls.semesterCode || '',
                  instructorName: cls.instructorName || detail.reviewedByName || '',
                  teamName: detail.teamName || team.teamName,
                  teamLeaderId: team.leaderId || detail.ownerId,
                  teamMembers: Array.isArray(team.members) ? team.members : [],
                }
              } catch {
                return null
              }
            })
          )
          return details.filter(Boolean)
        } catch {
          return []
        }
      })
    )

    return projectLists.flat().sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    )
  },

  async createSupplementaryBorrow(projectId, data) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tạo đơn mượn bổ sung thất bại'), { cause: error })
    }
  },

  async getSupplementaryBorrowById(id) {
    try {
      const response = await api.get(`/api/projects/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết đơn mượn'), { cause: error })
    }
  },

  async withdrawSupplementaryBorrow(projectId) {
    try {
      const response = await api.post(`/api/projects/${projectId}/supplementary-borrow/withdraw`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Thu hồi đơn mượn thất bại'), { cause: error })
    }
  },

  async getPendingApprovalProjects() {
    try {
      const response = await api.get('/api/projects/pending-approval')
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách đơn chờ duyệt'), { cause: error })
    }
  },

  async approveSupplementaryBorrow(projectId, comment = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/approve`, { comment })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Duyệt đơn thất bại'), { cause: error })
    }
  },

  async rejectSupplementaryBorrow(projectId, reason = '') {
    try {
      const response = await api.post(`/api/projects/${projectId}/reject`, { reason })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Từ chối đơn thất bại'), { cause: error })
    }
  },

  async getReturnRequests() {
    try {
      const response = await api.get('/api/borrow-requests', { params: { status: 'Returned' } })
      return response.data?.data?.items || response.data?.items || response.data || []
    } catch (error) {
      if (error.response?.status === 403) {
        try {
          const myResponse = await api.get('/api/borrow-requests/my', { params: { status: 'Returned' } })
          return myResponse.data?.data?.items || myResponse.data?.items || myResponse.data || []
        } catch {
          return []
        }
      }
      return []
    }
  },

  async getReturnRequestById(id) {
    try {
      const response = await api.get(`/api/borrow-requests/${id}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết phiếu trả'), { cause: error })
    }
  },

  async createReturnRequest(data) {
    try {
      const response = await api.post(`/api/borrow-requests/${data.borrowRequestId}/return`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tạo phiếu trả linh kiện thất bại'), { cause: error })
    }
  },

  async confirmReturnRequest(id, data = {}) {
    try {
      const response = await api.post(`/api/borrow-requests/${id}/return`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xác nhận trả linh kiện thất bại'), { cause: error })
    }
  },
}

export default borrowService
