import api, { extractErrorMessage } from './api'
import { MOCK_TEAMS, MOCK_TEAM_CANDIDATES, MOCK_TEAM_INVITATIONS } from './mockData'

let localTeams = JSON.parse(JSON.stringify(MOCK_TEAMS))
let localCandidates = JSON.parse(JSON.stringify(MOCK_TEAM_CANDIDATES))
let localInvitations = JSON.parse(JSON.stringify(MOCK_TEAM_INVITATIONS))

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
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/team-invitations/me gặp lỗi, sử dụng mock fallback')
        return localInvitations
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách lời mời nhóm'), { cause: error })
    }
  },

  /**
   * Sinh viên hiện tại chấp nhận hoặc từ chối lời mời vào nhóm
   * PUT /api/team-invitations/{teamId}/response
   * Quyền: Chỉ role Student
   * Path: teamId (guid)
   * Body (JSON): RespondTeamInvitationRequest { decision } ('Accept' / 'Reject')
   * Trả về (200): TeamResponse
   */
  async respondInvitation(teamId, decision) {
    try {
      const response = await api.put(`/api/team-invitations/${teamId}/response`, { decision })
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/team-invitations/{teamId}/response gặp lỗi, cập nhật mock fallback')
        localInvitations = localInvitations.filter((i) => i.teamId !== teamId)
        return localTeams[0] || null
      }
      throw new Error(extractErrorMessage(error, 'Phản hồi lời mời thất bại'), { cause: error })
    }
  },

  /**
   * Lấy nhóm đã tham gia của sinh viên hiện tại trong lớp
   * GET /api/classes/{classId}/team
   * Quyền: Chỉ role Student
   * Path: classId (guid)
   * Trả về (200): TeamResponse
   */
  async getMyTeam(classId) {
    try {
      const response = await api.get(`/api/classes/${classId}/team`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 404 || error.response?.status === 401 || !error.response) {
        const found = localTeams.find((t) => t.classId === classId)
        return found || null
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải thông tin nhóm trong lớp'), { cause: error })
    }
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
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/classes/{classId}/teams (POST) lỗi, tạo mock team')
        const newTeam = {
          teamId: `team-${Date.now()}`,
          classId: classId,
          classCode: 'EE302-01',
          teamName: data.teamName,
          leaderId: 'u-005',
          isReadyForProject: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          members: [
            {
              studentProfileId: 'u-005',
              studentCode: 'SE160245',
              fullName: 'Lê Hoàng Nam (Bạn)',
              isLeader: true,
              status: 'Accepted',
              invitedAt: new Date().toISOString(),
              respondedAt: new Date().toISOString(),
            },
          ],
        }
        localTeams.unshift(newTeam)
        return newTeam
      }
      throw new Error(extractErrorMessage(error, 'Tạo nhóm thất bại'), { cause: error })
    }
  },

  /**
   * Danh sách sinh viên cùng lớp mà trưởng nhóm có thể mời
   * GET /api/classes/{classId}/team-candidates
   * Quyền: Chỉ role Student
   * Path: classId (guid)
   * Trả về (200): TeamCandidateResponse[]
   */
  async getTeamCandidates(classId) {
    try {
      const response = await api.get(`/api/classes/${classId}/team-candidates`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        console.warn('API /api/classes/{classId}/team-candidates lỗi, sử dụng mock candidates')
        return localCandidates
      }
      throw new Error(extractErrorMessage(error, 'Không thể tải danh sách ứng viên'), { cause: error })
    }
  },

  /**
   * Chi tiết nhóm dành cho trưởng nhóm và thành viên đã chấp nhận
   * GET /api/teams/{teamId}
   * Quyền: Chỉ role Student
   * Path: teamId (guid)
   * Trả về (200): TeamResponse
   */
  async getTeamById(teamId) {
    try {
      const response = await api.get(`/api/teams/${teamId}`)
      return response.data?.data || response.data
    } catch (error) {
      if (error.response?.status === 500 || error.response?.status === 404 || error.response?.status === 401 || !error.response) {
        const found = localTeams.find((t) => t.teamId === teamId)
        if (found) return found
      }
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
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        const tIndex = localTeams.findIndex((t) => t.teamId === teamId)
        if (tIndex !== -1) {
          const cand = localCandidates.find((c) => c.studentProfileId === studentProfileId)
          if (cand) {
            localTeams[tIndex].members.push({
              studentProfileId: cand.studentProfileId,
              studentCode: cand.studentCode,
              fullName: cand.fullName,
              isLeader: false,
              status: 'Pending',
              invitedAt: new Date().toISOString(),
              respondedAt: null,
            })
            localCandidates = localCandidates.filter((c) => c.studentProfileId !== studentProfileId)
          }
          return localTeams[tIndex]
        }
      }
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
      if (error.response?.status === 500 || error.response?.status === 401 || !error.response) {
        const tIndex = localTeams.findIndex((t) => t.teamId === teamId)
        if (tIndex !== -1) {
          const removed = localTeams[tIndex].members.find((m) => m.studentProfileId === studentProfileId)
          if (removed) {
            localTeams[tIndex].members = localTeams[tIndex].members.filter((m) => m.studentProfileId !== studentProfileId)
            localCandidates.push({
              studentProfileId: removed.studentProfileId,
              studentCode: removed.studentCode,
              fullName: removed.fullName,
              major: 'Kỹ thuật Phần mềm',
              cohort: 'K16',
            })
          }
          return localTeams[tIndex]
        }
      }
      throw new Error(extractErrorMessage(error, 'Xóa lời mời thất bại'), { cause: error })
    }
  },
}
