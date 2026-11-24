import api, { extractErrorMessage, unwrapApiResponse } from './api'

const inFlightMyTeamRequests = new Map()

function normalizeVietnamese(text = '') {
  return String(text)
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .trim()
}

/**
 * Nhận diện lỗi 409 đặc thù khi lớp thuộc học kỳ không còn hoạt động
 * (phân biệt với các lỗi 409 nghiệp vụ khác).
 */
export function isInactiveSemesterTeamError(error) {
  const status = error?.response?.status ?? error?.cause?.response?.status
  if (status !== 409) return false
  const message = extractErrorMessage(error, '')
  const normalized = normalizeVietnamese(message)
  return (
    normalized.includes('hoc ky') &&
    (normalized.includes('khong con hoat dong') ||
      normalized.includes('ngung hoat dong') ||
      normalized.includes('khong hoat dong'))
  )
}

export const teamService = {
  /**
   * Danh sách lời mời đang chờ phản hồi của sinh viên hiện tại
   * GET /api/team-invitations/me
   * Quyền: Chỉ role Student
   * Trả về (200): TeamInvitationResponse[]
   */
  async getMyInvitations() {
    try {
      const response = await api.get('/api/team-invitations/me')
      return unwrapApiResponse(response, 'Không thể tải danh sách lời mời nhóm')
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách lời mời nhóm'), { cause: error })
    }
  },

  /**
   * Sinh viên hiện tại chấp nhận hoặc từ chối lời mời vào nhóm
   * PUT /api/team-invitations/{teamId}/response
   * Quyền: Chỉ role Student
   * Path: teamId (guid)
   * Body (JSON): RespondTeamInvitationRequest { decision } ('Accepted' / 'Rejected')
   * Trả về (200): TeamResponse
   */
  async respondInvitation(teamId, decision) {
    try {
      // Backend FluentValidation yêu cầu chính xác: "Accepted" hoặc "Rejected"
      const str = String(decision || '').trim().toLowerCase()
      const isReject =
        str.startsWith('rej') ||
        str.includes('từ chối') ||
        str.includes('tu choi') ||
        str === 'no' ||
        str === 'false'
      const normalizedDecision = isReject ? 'Rejected' : 'Accepted'
      const response = await api.put(`/api/team-invitations/${teamId}/response`, {
        decision: normalizedDecision,
        Decision: normalizedDecision,
      })
      return unwrapApiResponse(response, 'Phản hồi lời mời thất bại')
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Phản hồi lời mời thất bại'), { cause: error })
    }
  },

  /**
   * Lấy nhóm đã tham gia của sinh viên hiện tại trong lớp kèm trạng thái phân loại rõ ràng:
   * - 'ok': đã có nhóm (team != null)
   * - 'no_team': 404 (chưa thuộc nhóm nào trong lớp này - trạng thái hợp lệ)
   * - 'inactive_semester': 409 do học kỳ của lớp không còn hoạt động
   * - Các lỗi thực sự khác (mạng, 401/403, 500, 400, 409 khác) sẽ ném Error kèm message từ backend.
   * Gộp các request trùng classId đang chạy song song để tránh gọi lặp API.
   */
  async getMyTeamWithStatus(classId) {
    if (!classId) return { status: 'no_team', team: null }
    const key = String(classId)
    const existingRequest = inFlightMyTeamRequests.get(key)
    if (existingRequest) return existingRequest

    const request = (async () => {
      try {
        const response = await api.get(`/api/classes/${classId}/team`)
        const team = unwrapApiResponse(response, 'Không thể tải thông tin nhóm trong lớp')
        if (!team?.teamId) {
          return { status: 'no_team', team: null }
        }
        return { status: 'ok', team }
      } catch (error) {
        // 404: sinh viên chưa thuộc nhóm nào trong lớp này -> trạng thái hợp lệ, không phải lỗi
        if (error?.response?.status === 404) {
          return { status: 'no_team', team: null }
        }
        // 409 do học kỳ không còn hoạt động -> bỏ qua thao tác nhóm, không tính là lỗi tải dữ liệu
        if (isInactiveSemesterTeamError(error)) {
          return {
            status: 'inactive_semester',
            team: null,
            message: extractErrorMessage(error, 'Học kỳ của lớp không còn hoạt động'),
          }
        }
        throw new Error(extractErrorMessage(error, 'Không thể tải thông tin nhóm trong lớp'), { cause: error })
      } finally {
        inFlightMyTeamRequests.delete(key)
      }
    })()

    inFlightMyTeamRequests.set(key, request)
    return request
  },

  /**
   * Lấy nhóm đã tham gia của sinh viên hiện tại trong lớp
   * GET /api/classes/{classId}/team
   * Quyền: Chỉ role Student
   * Path: classId (guid)
   * Trả về (200): TeamResponse | null (nếu 404 chưa có nhóm hoặc 409 học kỳ không còn hoạt động)
   */
  async getMyTeam(classId) {
    const result = await teamService.getMyTeamWithStatus(classId)
    return result.team
  },

  /**
   * Tạo nhóm trong lớp; sinh viên hiện tại tự động là trưởng nhóm
   * POST /api/classes/{classId}/teams
   * Quyền: Chỉ role Student
   * Path: classId (guid)
   * Body (JSON): CreateTeamRequest { teamName }
   * Trả về (201): TeamResponse
   */
  async createTeam(classId, data) {
    try {
      const response = await api.post(`/api/classes/${classId}/teams`, data)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Tạo nhóm thất bại'), { cause: error })
    }
  },

  /**
   * Danh sách sinh viên cùng lớp mà trưởng nhóm có thể mời
   * GET /api/classes/{classId}/team-candidates
   * Quyền: Chỉ role Student & phải là Trưởng nhóm của lớp đó
   * Path: classId (guid)
   * Trả về (200): TeamCandidateResponse[]
   */
  async getTeamCandidates(classId) {
    try {
      const response = await api.get(`/api/classes/${classId}/team-candidates`)
      return response.data?.data || response.data
    } catch (error) {
      // 403 nghĩa là sinh viên không phải trưởng nhóm của lớp này (ForbiddenException từ backend)
      if (error.response?.status === 403) {
        return []
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách ứng viên'), { cause: error })
    }
  },

  /**
   * Chi tiết nhóm dành cho sinh viên, giảng viên phụ trách lớp và Admin
   * GET /api/teams/{teamId}
   * Quyền: Student, Lecturer, Admin
   * Path: teamId (guid)
   * Trả về (200): TeamResponse
   */
  async getTeamById(teamId) {
    try {
      const response = await api.get(`/api/teams/${teamId}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Không thể tải chi tiết nhóm'), { cause: error })
    }
  },

  /**
   * Trưởng nhóm gửi lời mời cho một sinh viên cùng lớp
   * POST /api/teams/{teamId}/invitations
   * Quyền: Chỉ role Student
   * Path: teamId (guid)
   * Body (JSON): InviteTeamMemberRequest { studentProfileId }
   * Trả về (200): TeamResponse
   */
  async inviteMember(teamId, studentProfileId) {
    try {
      const response = await api.post(`/api/teams/${teamId}/invitations`, { studentProfileId })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Gửi lời mời thất bại'), { cause: error })
    }
  },

  /**
   * Trưởng nhóm xóa lời mời chưa được chấp nhận
   * DELETE /api/teams/{teamId}/invitations/{studentProfileId}
   * Quyền: Chỉ role Student
   * Path: teamId (guid), studentProfileId (guid)
   * Trả về (200): TeamResponse
   */
  async cancelInvitation(teamId, studentProfileId) {
    try {
      const response = await api.delete(`/api/teams/${teamId}/invitations/${studentProfileId}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xóa lời mời thất bại'), { cause: error })
    }
  },

  /**
   * Thành viên rời nhóm (chưa đăng ký project); Trưởng nhóm phải chuyển quyền trước khi rời
   * POST /api/teams/{teamId}/leave
   * Quyền: Chỉ role Student
   * Path: teamId (guid)
   * Trả về (200): TeamResponse
   */
  async leaveTeam(teamId) {
    try {
      const response = await api.post(`/api/teams/${teamId}/leave`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Rời nhóm thất bại'), { cause: error })
    }
  },

  /**
   * Trưởng nhóm xóa thành viên đã tham gia (Accepted) khi nhóm chưa đăng ký project
   * DELETE /api/teams/{teamId}/members/{studentProfileId}
   * Quyền: Chỉ role Student
   * Path: teamId (guid), studentProfileId (guid)
   * Trả về (200): TeamResponse
   */
  async removeMember(teamId, studentProfileId) {
    try {
      const response = await api.delete(`/api/teams/${teamId}/members/${studentProfileId}`)
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Xóa thành viên thất bại'), { cause: error })
    }
  },

  /**
   * Chuyển quyền trưởng nhóm (Lecturer/Admin hoặc trưởng nhóm Student theo phạm vi backend)
   * PUT /api/teams/{teamId}/leader
   * Quyền: Student, Lecturer, Admin
   * Path: teamId (guid)
   * Body (JSON): TransferTeamLeaderRequest { studentProfileId }
   * Trả về (200): TeamResponse
   */
  async transferLeader(teamId, studentProfileId) {
    try {
      const response = await api.put(`/api/teams/${teamId}/leader`, { studentProfileId })
      return response.data?.data || response.data
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Chuyển quyền trưởng nhóm thất bại'), { cause: error })
    }
  },
}
