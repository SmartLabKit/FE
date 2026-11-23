/**
 * Chuẩn phản hồi từ backend API SmartLabKit
 */
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data: T
  errors: Record<string, any> | null
}

/**
 * Vai trò của thành viên trong nhóm
 */
export type TeamMemberRole = 'Leader' | 'Member'

/**
 * Trạng thái của thành viên trong nhóm
 */
export type TeamMemberStatus = 'Accepted' | 'Pending'

/**
 * Quyết định phản hồi lời mời vào nhóm
 */
export type InvitationDecision = 'Accepted' | 'Rejected'

/**
 * DTO thành viên của nhóm
 */
export interface TeamMemberDto {
  studentProfileId: string
  fullName: string
  studentCode: string
  role: TeamMemberRole
  status: TeamMemberStatus
}

/**
 * DTO thông tin nhóm trong lớp học (dành cho giảng viên / tổng quan)
 */
export interface ClassTeamDto {
  teamId: string
  teamName: string
  leaderFullName: string
  acceptedCount: number
  maxTeamSize: number
  pendingCount: number
  isFull: boolean
  isUnderMin: boolean
  hasProject: boolean
  members: TeamMemberDto[]
}

/**
 * DTO sinh viên chưa được phân nhóm
 */
export interface UnassignedStudentDto {
  studentProfileId: string
  fullName: string
  studentCode: string
}

/**
 * Phản hồi tổng quan tình hình chia nhóm của lớp học (Giảng viên)
 */
export interface TeamFormationOverviewResponse {
  studyingStudents: number
  teamCount: number
  unassignedCount: number
  underMinTeamCount: number
  minTeamSize: number | null
  maxTeamSize: number | null
  deadline: string | null
  studentsCanChangeTeams: boolean
  teams: ClassTeamDto[]
  unassignedStudents: UnassignedStudentDto[]
}

/**
 * Yêu cầu cập nhật cấu hình chia nhóm của lớp (Giảng viên)
 */
export interface UpdateTeamSettingsRequest {
  minTeamSize: number
  maxTeamSize: number
  deadline: string | null
}

/**
 * DTO thông tin nhóm hiện có trong bản xem trước chia nhóm tự động
 */
export interface AutoAssignExistingTeam {
  teamId: string
  teamName: string
  currentCount: number
  maxTeamSize: number
  addedStudents: UnassignedStudentDto[]
}

/**
 * DTO thông tin nhóm mới được gợi ý tạo trong bản xem trước chia nhóm tự động
 */
export interface AutoAssignNewTeam {
  teamName: string
  leaderStudentProfileId: string
  students: UnassignedStudentDto[]
}

/**
 * Phản hồi xem trước kết quả chia nhóm tự động (Giảng viên)
 */
export interface AutoAssignPreviewResponse {
  existingTeams: AutoAssignExistingTeam[]
  newTeams: AutoAssignNewTeam[]
  warnings: string[]
  requiresExceedMax: boolean
}

/**
 * DTO phân bổ sinh viên vào nhóm hiện có
 */
export interface AssignExistingTeamItem {
  teamId: string
  studentProfileIds: string[]
}

/**
 * DTO tạo nhóm mới và phân bổ sinh viên
 */
export interface AssignNewTeamItem {
  teamName: string
  leaderStudentProfileId: string
  studentProfileIds: string[]
}

/**
 * Yêu cầu áp dụng phân nhóm / gán nhóm sinh viên (Giảng viên)
 */
export interface AssignTeamsRequest {
  existingTeams: AssignExistingTeamItem[]
  newTeams: AssignNewTeamItem[]
  allowExceedMax: boolean
}

/**
 * Yêu cầu di chuyển thành viên giữa các nhóm (Giảng viên)
 */
export interface MoveMemberRequest {
  studentProfileId: string
  targetTeamId: string
  allowExceedMax: boolean
}

/**
 * Phản hồi thông tin nhóm của tôi (Sinh viên)
 */
export interface MyTeamResponse {
  teamId: string
  teamName: string
  memberCount: number
  isFull: boolean
  isReadyForProject: boolean
  members: TeamMemberDto[]
}

/**
 * DTO thông tin lời mời vào nhóm gửi tới sinh viên
 */
export interface TeamInvitationDto {
  teamId: string
  teamName: string
  leaderFullName: string
  memberCount: number
  maxTeamSize: number
}

/**
 * Request thay đổi quyền trưởng nhóm
 */
export interface ChangeTeamLeaderRequest {
  studentProfileId: string
}

/**
 * Request tạo nhóm mới của sinh viên
 */
export interface CreateTeamRequest {
  teamName: string
}

/**
 * Request mời thành viên vào nhóm
 */
export interface InviteMemberRequest {
  studentProfileId: string
}

/**
 * Request phản hồi lời mời vào nhóm
 */
export interface RespondInvitationRequest {
  decision: InvitationDecision
}
