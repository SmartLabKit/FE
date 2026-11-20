export function isTeamLeader(team, user) {
  if (!team || !user) return false
  const identity = [
    user.studentProfileId,
    user.profileId,
    user.userId,
    user.id,
    user.studentCode,
  ].filter(Boolean).map(String)

  if (identity.includes(String(team.leaderId))) return true
  return (team.members || []).some((member) => (
    member.isLeader &&
    identity.some((id) => id === String(member.studentProfileId) || id === String(member.studentCode))
  ))
}

export function getSemesterWeight(semesterCode = '') {
  const code = semesterCode.trim().toUpperCase()
  // Mã kỳ có thể có hậu tố, ví dụ FA26_A vẫn thuộc kỳ Thu năm 2026.
  const year = Number(code.match(/(?:^|\D)(?:20)?(\d{2})(?!\d)/)?.[1] || 0)
  const term = { FA: 3, SU: 2, SP: 1 }[code.slice(0, 2)] || 0
  return year * 10 + term
}

export function normalizeProjectSearch(value) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').trim()
}

export function getProjectListAction(team, project, isLeader) {
  if (project) {
    if (isLeader && project.status === 'Draft') return { label: 'Tiếp tục', variant: 'contained' }
    if (isLeader && project.status === 'Rejected') return { label: 'Chỉnh sửa', variant: 'contained' }
    return { label: 'Xem dự án', variant: 'outlined' }
  }

  if (!isLeader) return { message: 'Chờ trưởng nhóm' }
  if (!team.isReadyForProject) return { message: 'Nhóm chưa đủ điều kiện' }
  return { label: 'Tạo dự án', variant: 'contained' }
}
