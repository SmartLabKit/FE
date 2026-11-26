import api, { extractErrorMessage, unwrapApiResponse } from './api'
import type {
  ApiResponse,
  TeamFormationOverviewResponse,
  UpdateTeamSettingsRequest,
  AutoAssignPreviewResponse,
  AssignTeamsRequest,
  MoveMemberRequest,
  MyTeamResponse,
  UnassignedStudentDto,
  TeamInvitationDto,
} from '../types/team-formation'

const inFlightMyTeamRequests = new Map<string, Promise<MyTeamResponse | null>>()

function normalizeVietnamese(text = ''): string {
  return String(text)
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .trim()
}

function isInactiveSemesterTeamError(error: any): boolean {
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

/**
 * Hàm tiện ích bóc tách payload dữ liệu từ ApiResponse<T> dạng { success, message, data, errors }
 */
function unwrapResponse<T>(response: any, defaultErrorMsg?: string): T {
  return unwrapApiResponse(response, defaultErrorMsg) as T
}

// ============================================================================
// 1. NHÓM API GIẢNG VIÊN (LECTURER / ADMIN)
// ============================================================================

/**
 * Lấy tổng quan tình hình chia nhóm của lớp học
 * GET /api/classes/{classId}/team-formation
 * @param classId ID lớp học
 * @returns TeamFormationOverviewResponse
 */
export async function getTeamFormationOverview(
  classId: string
): Promise<TeamFormationOverviewResponse> {
  try {
    const response = await api.get<ApiResponse<TeamFormationOverviewResponse>>(
      `/api/classes/${classId}/team-formation`
    )
    return unwrapResponse<TeamFormationOverviewResponse>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Không thể tải thông tin tổng quan chia nhóm'),
      { cause: error }
    )
  }
}

/**
 * Cập nhật cấu hình chia nhóm của lớp (kích thước tối thiểu, tối đa, deadline)
 * PUT /api/classes/{classId}/team-formation/settings
 * @param classId ID lớp học
 * @param body Dữ liệu cấu hình: minTeamSize, maxTeamSize, deadline
 */
export async function updateTeamSettings(
  classId: string,
  body: UpdateTeamSettingsRequest
): Promise<any> {
  try {
    const response = await api.put<ApiResponse<any>>(
      `/api/classes/${classId}/team-formation/settings`,
      body
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Không thể cập nhật cấu hình chia nhóm'),
      { cause: error }
    )
  }
}

/**
 * Kết thúc sớm thời gian sinh viên chọn nhóm
 * POST /api/classes/{classId}/team-formation/close
 */
export async function closeTeamFormation(classId: string): Promise<any> {
  try {
    const response = await api.post<ApiResponse<any>>(`/api/classes/${classId}/team-formation/close`)
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Không thể kết thúc chọn nhóm'), { cause: error })
  }
}

/**
 * Đưa một sinh viên (không phải trưởng nhóm) ra khỏi nhóm
 * DELETE /api/classes/{classId}/team-formation/members/{studentProfileId}
 */
export async function removeTeamMember(classId: string, studentProfileId: string): Promise<any> {
  try {
    const response = await api.delete<ApiResponse<any>>(
      `/api/classes/${classId}/team-formation/members/${studentProfileId}`
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Không thể đưa sinh viên ra khỏi nhóm'), { cause: error })
  }
}

/**
 * Xem trước thuật toán tự động chia các sinh viên còn lại vào các nhóm
 * GET /api/classes/{classId}/team-formation/auto-assign/preview
 * @param classId ID lớp học
 * @returns AutoAssignPreviewResponse
 */
export async function getAutoAssignPreview(
  classId: string
): Promise<AutoAssignPreviewResponse> {
  try {
    const response = await api.get<ApiResponse<AutoAssignPreviewResponse>>(
      `/api/classes/${classId}/team-formation/auto-assign/preview`
    )
    return unwrapResponse<AutoAssignPreviewResponse>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Không thể tải bản xem trước phân nhóm tự động'),
      { cause: error }
    )
  }
}

/**
 * Áp dụng phân nhóm sinh viên (vào nhóm hiện có hoặc lập nhóm mới)
 * POST /api/classes/{classId}/team-formation/assignments
 * @param classId ID lớp học
 * @param body Dữ liệu phân nhóm: existingTeams, newTeams, allowExceedMax
 */
export async function assignTeams(
  classId: string,
  body: AssignTeamsRequest
): Promise<any> {
  try {
    const response = await api.post<ApiResponse<any>>(
      `/api/classes/${classId}/team-formation/assignments`,
      body
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Phân bổ nhóm cho sinh viên thất bại'),
      { cause: error }
    )
  }
}

/**
 * Di chuyển thành viên sang nhóm khác
 * POST /api/classes/{classId}/team-formation/moves
 * @param classId ID lớp học
 * @param body Dữ liệu chuyển nhóm: studentProfileId, targetTeamId, allowExceedMax
 */
export async function moveMember(
  classId: string,
  body: MoveMemberRequest
): Promise<any> {
  try {
    const response = await api.post<ApiResponse<any>>(
      `/api/classes/${classId}/team-formation/moves`,
      body
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Di chuyển thành viên thất bại'),
      { cause: error }
    )
  }
}

/**
 * Giảng viên / Trưởng nhóm thay đổi trưởng nhóm
 * PUT /api/teams/{teamId}/leader
 * @param teamId ID nhóm
 * @param newLeaderStudentProfileId ID profile của sinh viên làm trưởng nhóm mới
 */
export async function changeTeamLeader(
  teamId: string,
  newLeaderStudentProfileId: string
): Promise<any> {
  try {
    const response = await api.put<ApiResponse<any>>(
      `/api/teams/${teamId}/leader`,
      { studentProfileId: newLeaderStudentProfileId }
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Thay đổi trưởng nhóm thất bại'),
      { cause: error }
    )
  }
}

// ============================================================================
// 2. NHÓM API SINH VIÊN (STUDENT)
// ============================================================================

/**
 * Lấy thông tin nhóm của sinh viên hiện tại trong lớp học
 * GET /api/classes/{classId}/team
 * @param classId ID lớp học
 * @returns MyTeamResponse hoặc null nếu sinh viên chưa có nhóm
 */
export async function getMyTeam(
  classId: string
): Promise<MyTeamResponse | null> {
  if (!classId) return null
  const key = String(classId)
  const existing = inFlightMyTeamRequests.get(key)
  if (existing) return existing

  const request = (async (): Promise<MyTeamResponse | null> => {
    try {
      const response = await api.get<ApiResponse<MyTeamResponse>>(
        `/api/classes/${classId}/team`
      )
      return unwrapResponse<MyTeamResponse | null>(
        response,
        'Không thể tải thông tin nhóm của bạn'
      )
    } catch (error: any) {
      // 404: sinh viên chưa thuộc nhóm nào trong lớp này -> trạng thái hợp lệ (team = null)
      if (error?.response?.status === 404) {
        return null
      }
      // 409 do học kỳ của lớp không còn hoạt động -> không coi là lỗi tải thông tin nhóm
      if (isInactiveSemesterTeamError(error)) {
        return null
      }
      throw new Error(
        extractErrorMessage(error, 'Không thể tải thông tin nhóm của bạn'),
        { cause: error }
      )
    } finally {
      inFlightMyTeamRequests.delete(key)
    }
  })()

  inFlightMyTeamRequests.set(key, request)
  return request
}

/**
 * Sinh viên tạo nhóm mới trong lớp học (người tạo tự động làm trưởng nhóm)
 * POST /api/classes/{classId}/teams
 * @param classId ID lớp học
 * @param teamName Tên nhóm cần tạo
 */
export async function createTeam(
  classId: string,
  teamName: string
): Promise<MyTeamResponse | any> {
  try {
    const response = await api.post<ApiResponse<MyTeamResponse | any>>(
      `/api/classes/${classId}/teams`,
      { teamName }
    )
    return unwrapResponse<MyTeamResponse | any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Tạo nhóm mới thất bại'),
      { cause: error }
    )
  }
}

/**
 * Lấy danh sách các sinh viên cùng lớp chưa có nhóm để mời vào nhóm
 * GET /api/classes/{classId}/team-candidates
 * @param classId ID lớp học
 * @returns UnassignedStudentDto[]
 */
export async function getTeamCandidates(
  classId: string
): Promise<UnassignedStudentDto[]> {
  try {
    const response = await api.get<ApiResponse<UnassignedStudentDto[]>>(
      `/api/classes/${classId}/team-candidates`
    )
    const result = unwrapResponse<UnassignedStudentDto[]>(response)
    return Array.isArray(result) ? result : []
  } catch (error: any) {
    // 403 nếu sinh viên không phải trưởng nhóm
    if (error?.response?.status === 403) {
      return []
    }
    throw new Error(
      extractErrorMessage(error, 'Không thể tải danh sách ứng viên'),
      { cause: error }
    )
  }
}

/**
 * Trưởng nhóm gửi lời mời tham gia nhóm tới sinh viên trong lớp
 * POST /api/teams/{teamId}/invitations
 * @param teamId ID nhóm
 * @param studentProfileId ID profile của sinh viên được mời
 */
export async function inviteMember(
  teamId: string,
  studentProfileId: string
): Promise<any> {
  try {
    const response = await api.post<ApiResponse<any>>(
      `/api/teams/${teamId}/invitations`,
      { studentProfileId }
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Gửi lời mời tham gia nhóm thất bại'),
      { cause: error }
    )
  }
}

/**
 * Trưởng nhóm hủy lời mời đã gửi (chưa được phản hồi)
 * DELETE /api/teams/{teamId}/invitations/{studentProfileId}
 * @param teamId ID nhóm
 * @param studentProfileId ID profile của sinh viên đã nhận lời mời
 */
export async function cancelInvitation(
  teamId: string,
  studentProfileId: string
): Promise<any> {
  try {
    const response = await api.delete<ApiResponse<any>>(
      `/api/teams/${teamId}/invitations/${studentProfileId}`
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Hủy lời mời thất bại'),
      { cause: error }
    )
  }
}

/**
 * Thành viên rời nhóm (áp dụng khi nhóm chưa đăng ký đề tài)
 * POST /api/teams/{teamId}/leave
 * @param teamId ID nhóm
 */
export async function leaveTeam(teamId: string): Promise<any> {
  try {
    const response = await api.post<ApiResponse<any>>(
      `/api/teams/${teamId}/leave`
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Rời nhóm thất bại'),
      { cause: error }
    )
  }
}

/**
 * Trưởng nhóm xóa thành viên đã tham gia ra khỏi nhóm
 * DELETE /api/teams/{teamId}/members/{studentProfileId}
 * @param teamId ID nhóm
 * @param studentProfileId ID profile của thành viên cần xóa
 */
export async function removeMember(
  teamId: string,
  studentProfileId: string
): Promise<any> {
  try {
    const response = await api.delete<ApiResponse<any>>(
      `/api/teams/${teamId}/members/${studentProfileId}`
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Xóa thành viên khỏi nhóm thất bại'),
      { cause: error }
    )
  }
}

/**
 * Sinh viên lấy danh sách tất cả các lời mời vào nhóm đang chờ phản hồi
 * GET /api/team-invitations/me
 * @returns TeamInvitationDto[]
 */
export async function getMyInvitations(): Promise<TeamInvitationDto[]> {
  try {
    const response = await api.get<ApiResponse<TeamInvitationDto[]>>(
      '/api/team-invitations/me'
    )
    const result = unwrapResponse<TeamInvitationDto[]>(response)
    return Array.isArray(result) ? result : []
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Không thể tải danh sách lời mời nhóm'),
      { cause: error }
    )
  }
}

/**
 * Sinh viên phản hồi (chấp nhận / từ chối) lời mời vào nhóm
 * PUT /api/team-invitations/{teamId}/response
 * @param teamId ID nhóm gửi lời mời
 * @param decision 'Accepted' | 'Rejected'
 */
export async function respondInvitation(
  teamId: string,
  decision: 'Accepted' | 'Rejected'
): Promise<any> {
  try {
    const response = await api.put<ApiResponse<any>>(
      `/api/team-invitations/${teamId}/response`,
      { decision }
    )
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, 'Phản hồi lời mời thất bại'),
      { cause: error }
    )
  }
}

/**
 * Thành viên được đề nghị làm trưởng nhóm nhận hoặc từ chối
 * POST /api/teams/{teamId}/leader/respond
 * @param decision 'Accepted' (nhận làm trưởng nhóm) | 'Rejected'
 */
export async function respondLeaderTransfer(
  teamId: string,
  decision: 'Accepted' | 'Rejected'
): Promise<any> {
  try {
    const response = await api.post<ApiResponse<any>>(`/api/teams/${teamId}/leader/respond`, { decision })
    return unwrapResponse<any>(response)
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Không thể trả lời đề nghị làm trưởng nhóm'), { cause: error })
  }
}

// Gom toàn bộ hàm vào một object teamFormationApi để hỗ trợ cả 2 cách import
export const teamFormationApi = {
  // Giảng viên
  getTeamFormationOverview,
  updateTeamSettings,
  getAutoAssignPreview,
  assignTeams,
  moveMember,
  changeTeamLeader,
  // Sinh viên
  getMyTeam,
  createTeam,
  getTeamCandidates,
  inviteMember,
  cancelInvitation,
  leaveTeam,
  removeMember,
  getMyInvitations,
  respondInvitation,
  respondLeaderTransfer,
}

export default teamFormationApi
