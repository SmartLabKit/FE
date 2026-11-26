import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { assignTeams, getAutoAssignPreview } from '../../services/teamFormationApi'
import { extractErrorMessage } from '../../services/api'

const KEEP = 'keep'
const newKey = (index) => `new:${index}`

/**
 * Xem trước chia nhóm tự động, chỉ mở khi có gộp nhóm, vượt tối đa hoặc cảnh báo (trường hợp thường thì xếp luôn):
 * bạn lẻ được xếp vào đâu, nhóm thiếu người gộp vào nhóm nào, nhóm mới nào được tạo. Giảng viên sửa được mọi chỗ, bấm Xác nhận mới lưu.
 */
export default function AutoAssignDialog({ classId, initialPreview, teams, minTeamSize, maxTeamSize, onClose, onDone }) {
  const [preview, setPreview] = useState(null)
  const [students, setStudents] = useState([])
  const [newTeams, setNewTeams] = useState([])
  const [merges, setMerges] = useState([])
  const [allowExceedMax, setAllowExceedMax] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const load = initialPreview ? Promise.resolve(initialPreview) : getAutoAssignPreview(classId)
    load
      .then((data) => {
        if (!active) return
        setPreview(data)
        setNewTeams(data.newTeams.map((team) => ({ teamName: team.teamName, leaderId: team.leaderStudentProfileId })))
        setMerges(data.merges.map((merge) => ({ ...merge, choice: merge.targetTeamId })))
        setStudents([
          ...data.existingTeams.flatMap((team) => team.addedStudents.map((student) => ({ ...student, target: team.teamId }))),
          ...data.newTeams.flatMap((team, index) => team.students.map((student) => ({ ...student, target: newKey(index) }))),
        ])
      })
      .catch((previewError) => {
        if (active) setLoadError(extractErrorMessage(previewError, 'Không thể xem trước chia nhóm.'))
      })
    return () => {
      active = false
    }
  }, [classId, initialPreview])

  // Nhóm đã có đề tài được duyệt giữ nguyên thành viên khi chia tự động
  const openTeams = teams.filter((team) => !team.projectApproved)
  const mergedAway = new Set(merges.filter((merge) => merge.choice !== KEEP).map((merge) => merge.sourceTeamId))
  const targetTeams = openTeams.filter((team) => !mergedAway.has(team.teamId))
  // Nhóm đang nhận một nhóm khác hoặc nhận bạn lẻ thì không tự gộp đi chỗ khác nữa
  const receiving = new Set([
    ...merges.filter((merge) => merge.choice !== KEEP).map((merge) => merge.choice),
    ...students.map((student) => student.target),
  ])

  const sizeOf = (key) => {
    const team = openTeams.find((item) => item.teamId === key)
    const joined = merges.filter((merge) => merge.choice === key).reduce((sum, merge) => sum + merge.members.length, 0)
    return (team?.acceptedCount || 0) + joined + students.filter((student) => student.target === key).length
  }
  const membersOfNew = (index) => students.filter((student) => student.target === newKey(index))
  const leaderOf = (index) => {
    const members = membersOfNew(index)
    const chosen = members.find((member) => member.studentProfileId === newTeams[index].leaderId)
    return (chosen || members[0])?.studentProfileId || ''
  }

  const rows = [
    ...targetTeams
      .filter((team) => receiving.has(team.teamId) || team.acceptedCount < minTeamSize)
      .map((team) => ({ key: team.teamId, name: team.teamName })),
    ...newTeams.map((team, index) => ({ key: newKey(index), name: team.teamName || `Nhóm mới ${index + 1}` })),
  ].filter((row) => sizeOf(row.key) > 0)
  const tooBig = rows.filter((row) => sizeOf(row.key) > maxTeamSize)
  const tooSmall = rows.filter((row) => sizeOf(row.key) < minTeamSize)
  const nothing = preview && students.length === 0 && merges.length === 0

  const setTarget = (studentId, target) =>
    setStudents((previous) => previous.map((student) => (student.studentProfileId === studentId ? { ...student, target } : student)))
  const setMergeChoice = (sourceTeamId, choice) =>
    setMerges((previous) => previous.map((merge) => (merge.sourceTeamId === sourceTeamId ? { ...merge, choice } : merge)))
  const editNewTeam = (index, change) =>
    setNewTeams((previous) => previous.map((team, i) => (i === index ? { ...team, ...change } : team)))

  const save = async () => {
    setSaving(true)
    setError('')
    const existingIds = [...new Set(students.map((student) => student.target).filter((target) => !target.startsWith('new:')))]
    try {
      await assignTeams(classId, {
        existingTeams: existingIds.map((teamId) => ({
          teamId,
          studentProfileIds: students.filter((student) => student.target === teamId).map((student) => student.studentProfileId),
        })),
        newTeams: newTeams
          .map((team, index) => ({
            teamName: team.teamName.trim(),
            leaderStudentProfileId: leaderOf(index),
            studentProfileIds: membersOfNew(index).map((student) => student.studentProfileId),
          }))
          .filter((team) => team.studentProfileIds.length > 0),
        merges: merges
          .filter((merge) => merge.choice !== KEEP)
          .map((merge) => ({ sourceTeamId: merge.sourceTeamId, targetTeamId: merge.choice })),
        allowExceedMax,
      })
      onDone()
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể chia nhóm.'))
      setSaving(false)
    }
  }

  const canSave =
    preview && !nothing && !saving && (tooBig.length === 0 || allowExceedMax) && newTeams.every((team, index) => team.teamName.trim() || membersOfNew(index).length === 0)

  return (
    <Dialog open onClose={() => !saving && onClose()} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Chia nhóm tự động</DialogTitle>
      <DialogContent dividers>
        {loadError && <Alert severity="error">{loadError}</Alert>}
        {!preview && !loadError && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        )}
        {preview && (
          <Stack spacing={2.5}>
            {preview.warnings.length > 0 && (
              <Alert severity={nothing ? 'success' : 'warning'}>
                {preview.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </Alert>
            )}

            {students.length > 0 && (
              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Bạn chưa có nhóm ({students.length})</Typography>
                <Stack spacing={1}>
                  {students.map((student) => (
                    <Stack key={student.studentProfileId} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {student.fullName} ({student.studentCode})
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={student.target}
                        onChange={(event) => setTarget(student.studentProfileId, event.target.value)}
                        slotProps={{ htmlInput: { 'aria-label': `Nhóm của ${student.fullName}` } }}
                        sx={{ width: { xs: '100%', sm: 260 } }}
                      >
                        {targetTeams.map((team) => (
                          <MenuItem key={team.teamId} value={team.teamId}>{team.teamName}</MenuItem>
                        ))}
                        {newTeams.map((team, index) => (
                          <MenuItem key={newKey(index)} value={newKey(index)}>{team.teamName || `Nhóm mới ${index + 1}`} (mới)</MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {merges.length > 0 && (
              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Nhóm thiếu người, gộp cả nhóm</Typography>
                <Stack spacing={1}>
                  {merges.map((merge) => (
                    <Stack key={merge.sourceTeamId} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {merge.sourceTeamName}: {merge.members.map((member) => member.fullName).join(', ')}
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={merge.choice}
                        onChange={(event) => setMergeChoice(merge.sourceTeamId, event.target.value)}
                        slotProps={{ htmlInput: { 'aria-label': `Gộp ${merge.sourceTeamName}` } }}
                        sx={{ width: { xs: '100%', sm: 260 } }}
                      >
                        <MenuItem value={KEEP}>Không gộp</MenuItem>
                        {targetTeams
                          .filter((team) => team.teamId !== merge.sourceTeamId)
                          .map((team) => (
                            <MenuItem key={team.teamId} value={team.teamId} disabled={receiving.has(merge.sourceTeamId)}>
                              Vào {team.teamName}
                            </MenuItem>
                          ))}
                      </TextField>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {newTeams.some((_team, index) => membersOfNew(index).length > 0) && (
              <Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Nhóm mới</Typography>
                <Stack spacing={1.5}>
                  {newTeams.map((team, index) => {
                    const members = membersOfNew(index)
                    if (members.length === 0) return null
                    return (
                      <Stack key={newKey(index)} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          size="small"
                          label="Tên nhóm"
                          value={team.teamName}
                          onChange={(event) => editNewTeam(index, { teamName: event.target.value })}
                          slotProps={{ htmlInput: { maxLength: 100 } }}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          select
                          size="small"
                          label="Trưởng nhóm"
                          value={leaderOf(index)}
                          onChange={(event) => editNewTeam(index, { leaderId: event.target.value })}
                          sx={{ flex: 1 }}
                        >
                          {members.map((member) => (
                            <MenuItem key={member.studentProfileId} value={member.studentProfileId}>{member.fullName}</MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                    )
                  })}
                </Stack>
              </Box>
            )}

            {rows.length > 0 && (
              <Box>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Kết quả</Typography>
                <Typography variant="body2">{rows.map((row) => `${row.name}: ${sizeOf(row.key)} người`).join(' · ')}</Typography>
                {tooSmall.length > 0 && (
                  <Typography variant="body2" sx={{ color: '#b45309', mt: 0.5 }}>
                    Chưa đủ {minTeamSize} người: {tooSmall.map((row) => row.name).join(', ')}
                  </Typography>
                )}
              </Box>
            )}

            {tooBig.length > 0 && (
              <FormControlLabel
                control={<Checkbox checked={allowExceedMax} onChange={(event) => setAllowExceedMax(event.target.checked)} color="warning" />}
                label={`Cho phép vượt ${maxTeamSize} người: ${tooBig.map((row) => row.name).join(', ')}`}
              />
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Đóng</Button>
        <Button variant="contained" onClick={save} disabled={!canSave} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {saving ? 'Đang lưu...' : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
