import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import {
  getTeamFormationOverview,
  updateTeamSettings,
  closeTeamFormation,
  assignTeams,
  getAutoAssignPreview,
  moveMember,
  removeTeamMember,
} from '../../services/teamFormationApi'
import { extractErrorMessage } from '../../services/api'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import AutoAssignDialog from './AutoAssignDialog'

/** 17 bạn, tối đa 4 → [4, 4, 3, 3, 3]; null khi không chia được theo cỡ nhóm (BE cũng chặn). */
// Giống BE: không lập nhóm dưới số tối thiểu, không vượt tối đa; ai không vừa thì chưa có nhóm (10 bạn, 4–4 → 4, 4, dư 2)
function planSizes(students, min, max) {
  if (!students || !min || !max || min > max) return null
  const most = Math.floor(students / min)
  let count = most
  for (let k = 0; k <= most; k += 1) {
    if (students <= k * max) {
      count = k
      break
    }
  }
  const placed = Math.min(students, count * max)
  const sizes = Array.from({ length: count }, (_, index) => Math.floor(placed / count) + (index < placed % count ? 1 : 0))
  return { sizes, leftover: students - placed }
}

/**
 * Định dạng chuỗi ngày tháng sang DD/MM/YYYY HH:mm
 */
function formatDeadlineDisplay(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

/**
 * Chuyển đổi giá trị ISO từ backend sang dạng YYYY-MM-DDTHH:mm cho input type="datetime-local"
 */
function toDatetimeLocalInput(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Component Tab "Chia nhóm" dành cho Giảng viên (Màn 1)
 * 1. Đặt cỡ nhóm và hạn chót thì sinh viên mới tự chọn nhóm được.
 * 2. Hết hạn (hoặc kết thúc sớm) thì chia nhóm tự động cho các bạn còn lại, xem trước rồi mới lưu.
 */
export default function TeamFormationTab({
  classId,
  onOpenMoveMember,
  onOpenManualAssign,
}) {
  // Dữ liệu tổng quan chia nhóm từ backend
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  // State form Cấu hình nhóm (Khối 3)
  const [minTeamSize, setMinTeamSize] = useState('')
  const [maxTeamSize, setMaxTeamSize] = useState('')
  const [deadline, setDeadline] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState('')

  // State danh sách sinh viên lẻ được tick chọn (Khối 5)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [showUnassigned, setShowUnassigned] = useState(false)

  // Modal placeholders sẵn sàng cho Task 3
  const [autoAssignOpen, setAutoAssignOpen] = useState(false)
  const [autoPreview, setAutoPreview] = useState(null)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoMessage, setAutoMessage] = useState(null)
  const [confirmRequest, setConfirmRequest] = useState(null)
  const [moveMemberOpen, setMoveMemberOpen] = useState(false)
  const [selectedTeamForMove, setSelectedTeamForMove] = useState(null)
  const [manualAssignOpen, setManualAssignOpen] = useState(false)

  /**
   * Tải tổng quan chia nhóm duy nhất 1 lần khi tab mount (hoặc khi classId thay đổi)
   */
  useEffect(() => {
    let active = true

    if (!classId) return

    const fetchOverview = async () => {
      setLoading(true)
      setPageError('')
      setSettingsError('')
      setSettingsSuccess('')
      setSelectedStudentIds([])
      try {
        const data = await getTeamFormationOverview(classId)
        if (active && data) {
          setOverview(data)
          setMinTeamSize(data.minTeamSize !== null && data.minTeamSize !== undefined ? data.minTeamSize : '')
          setMaxTeamSize(data.maxTeamSize !== null && data.maxTeamSize !== undefined ? data.maxTeamSize : '')
          setDeadline(toDatetimeLocalInput(data.deadline))
        }
      } catch (err) {
        if (active) {
          setPageError(extractErrorMessage(err, 'Không thể tải thông tin chia nhóm của lớp'))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchOverview()

    return () => {
      active = false
    }
  }, [classId])

  // Tải lại sau khi thay đổi (hoặc khi sinh viên vừa đổi nhóm), giữ nguyên ô cấu hình đang nhập
  const reload = useCallback(() => {
    if (!classId) return
    getTeamFormationOverview(classId)
      .then((data) => {
        if (!data) return
        setOverview(data)
        setSelectedStudentIds((previous) =>
          previous.filter((id) => (data.unassignedStudents || []).some((student) => student.studentProfileId === id))
        )
      })
      .catch(() => {})
  }, [classId])
  useEntityChanged(reload)

  // Bấm Chia nhóm tự động: bình thường xếp luôn; có gộp nhóm, vượt tối đa hoặc cảnh báo thì mở bảng xem trước để GV xác nhận
  const handleAutoAssign = async () => {
    setAutoAssigning(true)
    setAutoMessage(null)
    try {
      const preview = await getAutoAssignPreview(classId)
      const placesSomeone = preview.existingTeams.length > 0 || preview.newTeams.length > 0
      const needsReview = preview.merges.length > 0 || preview.requiresExceedMax || preview.warnings.length > 0
      if (!placesSomeone && !needsReview) {
        setAutoMessage({ severity: 'info', text: 'Không còn ai cần xếp nhóm.' })
        return
      }
      if (needsReview) {
        setAutoPreview(preview)
        setAutoAssignOpen(true)
        return
      }
      await assignTeams(classId, {
        existingTeams: preview.existingTeams.map((team) => ({
          teamId: team.teamId,
          studentProfileIds: team.addedStudents.map((student) => student.studentProfileId),
        })),
        newTeams: preview.newTeams.map((team) => ({
          teamName: team.teamName,
          leaderStudentProfileId: team.leaderStudentProfileId,
          studentProfileIds: team.students.map((student) => student.studentProfileId),
        })),
        merges: [],
        allowExceedMax: false,
      })
      const placed =
        preview.existingTeams.reduce((sum, team) => sum + team.addedStudents.length, 0) +
        preview.newTeams.reduce((sum, team) => sum + team.students.length, 0)
      let text = `Đã xếp ${placed} sinh viên vào nhóm.`
      if (preview.newTeams.length > 0) text = `Đã xếp ${placed} sinh viên, tạo thêm ${preview.newTeams.length} nhóm mới.`
      setAutoMessage({ severity: 'success', text })
      reload()
    } catch (autoError) {
      setAutoMessage({ severity: 'error', text: extractErrorMessage(autoError, 'Không thể chia nhóm tự động.') })
    } finally {
      setAutoAssigning(false)
    }
  }

  const confirmClose = () =>
    setConfirmRequest({
      title: 'Kết thúc chọn nhóm?',
      message: 'Sinh viên sẽ không tự đổi nhóm được nữa, lời mời chưa trả lời bị hủy.',
      confirmText: 'Kết thúc',
      onConfirm: async () => {
        setSettingsError('')
        try {
          const data = await closeTeamFormation(classId)
          setOverview(data)
          setDeadline(toDatetimeLocalInput(data.deadline))
        } catch (closeError) {
          setSettingsError(extractErrorMessage(closeError, 'Không thể kết thúc chọn nhóm.'))
        }
      },
    })

  /**
   * Lưu cấu hình nhóm (PUT /api/classes/{classId}/team-formation/settings)
   */
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault()
    if (!classId) return

    setSavingSettings(true)
    setSettingsError('')
    setSettingsSuccess('')

    const min = Number(minTeamSize)
    const max = Number(maxTeamSize)

    if (Number.isNaN(min) || min <= 0) {
      setSettingsError('Số lượng tối thiểu mỗi nhóm phải là số nguyên lớn hơn 0.')
      setSavingSettings(false)
      return
    }

    if (Number.isNaN(max) || max <= 0) {
      setSettingsError('Số lượng tối đa mỗi nhóm phải là số nguyên lớn hơn 0.')
      setSavingSettings(false)
      return
    }

    if (min > max) {
      setSettingsError('Số lượng tối thiểu không được lớn hơn số lượng tối đa.')
      setSavingSettings(false)
      return
    }

    if (!deadline) {
      setSettingsError('Vui lòng chọn hạn chót chọn nhóm.')
      setSavingSettings(false)
      return
    }

    const payload = {
      minTeamSize: min,
      maxTeamSize: max,
      deadline: new Date(deadline).toISOString(),
    }

    try {
      const data = await updateTeamSettings(classId, payload)
      setOverview(data)
      setSettingsSuccess('Đã lưu, sinh viên trong lớp được báo.')
    } catch (err) {
      // Bóc tách message phản hồi từ backend (đặc biệt khi HTTP 409 Conflict)
      const respMessage =
        err?.cause?.response?.data?.message ||
        err?.response?.data?.message ||
        extractErrorMessage(err, 'Lưu cấu hình thất bại.')
      setSettingsError(respMessage)
    } finally {
      setSavingSettings(false)
    }
  }

  /**
   * Chọn / Bỏ chọn từng sinh viên lẻ
   */
  const toggleStudentSelection = (studentProfileId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentProfileId)
        ? prev.filter((id) => id !== studentProfileId)
        : [...prev, studentProfileId]
    )
  }

  /**
   * Chọn tất cả hoặc bỏ chọn tất cả sinh viên lẻ
   */
  const handleToggleSelectAllStudents = () => {
    const allStudents = overview?.unassignedStudents || []
    if (selectedStudentIds.length === allStudents.length) {
      setSelectedStudentIds([])
    } else {
      setSelectedStudentIds(allStudents.map((s) => s.studentProfileId))
    }
  }

  // Xử lý mở các Modal
  const handleOpenMoveMemberModal = (team) => {
    if (onOpenMoveMember) {
      onOpenMoveMember(team)
    } else {
      setSelectedTeamForMove(team)
      setMoveMemberOpen(true)
    }
  }

  const handleOpenManualAssignModal = () => {
    if (onOpenManualAssign) {
      onOpenManualAssign(selectedStudentIds)
    } else {
      setManualAssignOpen(true)
    }
  }

  // Trạng thái đang tải dữ liệu lần đầu
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress size={36} />
      </Box>
    )
  }

  // Lỗi tải dữ liệu
  if (pageError) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {pageError}
      </Alert>
    )
  }

  if (!overview) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        Không tìm thấy thông tin chia nhóm cho lớp này.
      </Alert>
    )
  }

  const unassignedCount = overview.unassignedCount ?? 0
  const isSettingsConfigured =
    overview.minTeamSize !== null &&
    overview.minTeamSize !== undefined &&
    overview.maxTeamSize !== null &&
    overview.maxTeamSize !== undefined

  const choosing = overview.studentsCanChangeTeams === true
  const needsLecturer = unassignedCount > 0 || (overview.underMinTeamCount ?? 0) > 0
  const sizes = planSizes(overview.studyingStudents, Number(minTeamSize), Number(maxTeamSize))
  const unassignedStudents = overview.unassignedStudents || []
  const teams = overview.teams || []

  return (
    <Stack spacing={2.5} sx={{ width: '100%', minWidth: 0 }}>
      {/* ======================================================================
          KHỐI 1: BANNER TRÊN CÙNG
          ====================================================================== */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          borderColor: '#b9d9fe',
          bgcolor: '#f0f7ff',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          {/* Bên trái: Tiêu đề trạng thái hạn chót & mô tả */}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e3a8a', lineHeight: 1.3 }}>
              {!isSettingsConfigured
                ? 'Chưa mở chọn nhóm'
                : choosing
                  ? `Sinh viên đang tự chọn nhóm${overview.deadline ? ` tới ${formatDeadlineDisplay(overview.deadline)}` : ''}`
                  : 'Đã hết hạn chọn nhóm'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mt: 0.75, lineHeight: 1.5 }}>
              {!isSettingsConfigured
                ? 'Đặt số thành viên và hạn chót bên dưới thì sinh viên mới tạo nhóm được.'
                : choosing
                  ? 'Hết hạn thì bạn chia nhóm cho các bạn còn lại.'
                  : needsLecturer
                    ? 'Còn bạn chưa có nhóm hoặc nhóm thiếu người, bấm Chia nhóm tự động để xem trước.'
                    : 'Cả lớp đã có nhóm đủ người.'}
            </Typography>
          </Box>

          {choosing && (
            <Button variant="outlined" onClick={confirmClose} sx={{ whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'none', flexShrink: 0, alignSelf: 'center', ml: { md: 'auto !important' } }}>
              Kết thúc sớm
            </Button>
          )}
          {isSettingsConfigured && !choosing && needsLecturer && (
            <Button
              variant="contained"
              onClick={handleAutoAssign}
              disabled={autoAssigning}
              startIcon={autoAssigning ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'none', boxShadow: 'none', flexShrink: 0, alignSelf: 'center', ml: { md: 'auto !important' } }}
            >
              Chia nhóm tự động
            </Button>
          )}
        </Stack>
        {autoMessage && (
          <Alert severity={autoMessage.severity} onClose={() => setAutoMessage(null)} sx={{ mt: 2 }}>
            {autoMessage.text}
          </Alert>
        )}
      </Paper>

      {/* ======================================================================
          KHỐI 2: HÀNG 4 THẺ KPI (GRID 4 CỘT)
          ====================================================================== */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {/* Thẻ 1: Sinh viên đang học */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.25,
            borderRadius: 2,
            borderColor: '#e2e8f0',
            bgcolor: '#ffffff',
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
          >
            Sinh viên đang học
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 900, color: '#111827', mt: 0.75, lineHeight: 1 }}
          >
            {overview.studyingStudents ?? 0}
          </Typography>
        </Paper>

        {/* Thẻ 2: Số nhóm */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.25,
            borderRadius: 2,
            borderColor: '#e2e8f0',
            bgcolor: '#ffffff',
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
          >
            Tổng số nhóm
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 900, color: '#111827', mt: 0.75, lineHeight: 1 }}
          >
            {overview.teamCount ?? 0}
          </Typography>
        </Paper>

        {/* Thẻ 3: Chưa có nhóm */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.25,
            borderRadius: 2,
            borderColor: '#fed7aa',
            bgcolor: '#fffbf5',
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.4 }}
          >
            Chưa có nhóm
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 900, color: '#ea580c', mt: 0.75, lineHeight: 1 }}
          >
            {overview.unassignedCount ?? 0}
          </Typography>
        </Paper>

        {/* Thẻ 4: Nhóm dưới tối thiểu */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.25,
            borderRadius: 2,
            borderColor: '#fed7aa',
            bgcolor: '#fffbf5',
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.4 }}
          >
            Nhóm thiếu người
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 900, color: '#ea580c', mt: 0.75, lineHeight: 1 }}
          >
            {overview.underMinTeamCount ?? 0}
          </Typography>
        </Paper>
      </Box>

      {/* ======================================================================
          KHỐI 3: CARD "CẤU HÌNH NHÓM"
          ====================================================================== */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          borderColor: '#e2e8f0',
          bgcolor: '#ffffff',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
          Cấu hình nhóm
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2 }}>
          Lưu xong, cả lớp được báo và tự chọn nhóm tới hạn chót.
        </Typography>

        <Box component="form" onSubmit={handleSaveSettings}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            {/* Input 1: Tối thiểu mỗi nhóm */}
            <TextField
              size="small"
              label="Tối thiểu mỗi nhóm"
              type="number"
              value={minTeamSize}
              onChange={(e) => setMinTeamSize(e.target.value)}
              slotProps={{
                htmlInput: { min: 1 },
              }}
              sx={{ width: { xs: '100%', md: 180 } }}
              required
            />

            {/* Input 2: Tối đa mỗi nhóm */}
            <TextField
              size="small"
              label="Tối đa mỗi nhóm"
              type="number"
              value={maxTeamSize}
              onChange={(e) => setMaxTeamSize(e.target.value)}
              slotProps={{
                htmlInput: { min: 1 },
              }}
              sx={{ width: { xs: '100%', md: 180 } }}
              required
            />

            {/* Input 3: Hạn chót */}
            <TextField
              size="small"
              label="Hạn chót"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: { xs: '100%', md: 250 } }}
              required
            />

            {/* Nút 4: Lưu cấu hình */}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={savingSettings}
              startIcon={savingSettings ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              sx={{
                fontWeight: 700,
                px: 2.5,
                py: 1,
                borderRadius: 1.75,
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Lưu cấu hình
            </Button>
          </Stack>

          {Number(minTeamSize) > 0 && Number(maxTeamSize) > 0 && overview.studyingStudents > 0 && (
            <Typography variant="body2" sx={{ mt: 1.5, color: sizes?.leftover ? '#b45309' : 'text.secondary' }}>
              {!sizes
                ? 'Số tối thiểu phải nhỏ hơn hoặc bằng số tối đa'
                : sizes.sizes.length === 0
                  ? `${overview.studyingStudents} bạn chưa đủ ${minTeamSize} người để lập nhóm`
                  : `${overview.studyingStudents} bạn → ${sizes.sizes.length} nhóm: ${sizes.sizes.join(', ')} người` +
                    (sizes.leftover > 0 ? ` · ${sizes.leftover} bạn chưa có nhóm, giảng viên tự xếp` : '')}
            </Typography>
          )}

          {/* Dòng text lỗi màu đỏ ngay dưới form (HTTP 409 hoặc lỗi cấu hình) */}
          {settingsError && (
            <Typography
              variant="body2"
              sx={{ color: '#dc2626', fontWeight: 600, mt: 1.5, display: 'block' }}
            >
              {settingsError}
            </Typography>
          )}

          {/* Thông báo lưu thành công */}
          {settingsSuccess && (
            <Typography
              variant="body2"
              sx={{ color: '#16a34a', fontWeight: 600, mt: 1.5, display: 'block' }}
            >
              {settingsSuccess}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* ======================================================================
          KHỐI 4: CARD BẢNG "NHÓM TRONG LỚP ({teamCount})"
          ====================================================================== */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          borderColor: '#e2e8f0',
          bgcolor: '#ffffff',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5 }}>
          Nhóm trong lớp ({overview.teamCount ?? 0})
        </Typography>

        <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ py: 1.2, fontWeight: 800, fontSize: 11, color: '#475569' }}>NHÓM</TableCell>
                <TableCell sx={{ py: 1.2, fontWeight: 800, fontSize: 11, color: '#475569' }}>TRƯỞNG NHÓM</TableCell>
                <TableCell align="center" sx={{ py: 1.2, fontWeight: 800, fontSize: 11, color: '#475569' }}>
                  THÀNH VIÊN
                </TableCell>
                <TableCell align="center" sx={{ py: 1.2, fontWeight: 800, fontSize: 11, color: '#475569' }}>
                  LỜI MỜI CHỜ
                </TableCell>
                <TableCell align="center" sx={{ py: 1.2, fontWeight: 800, fontSize: 11, color: '#475569' }}>
                  TÌNH TRẠNG
                </TableCell>
                <TableCell align="center" sx={{ py: 1.2, fontWeight: 800, fontSize: 11, color: '#475569' }}>
                  ĐỀ TÀI
                </TableCell>
                <TableCell align="right" sx={{ py: 1.2, fontWeight: 800, fontSize: 11, color: '#475569' }}>
                  THAO TÁC
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Chưa có nhóm nào được tạo trong lớp này.
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => {
                  const min = overview.minTeamSize || 0
                  const missingCount = Math.max(0, min - (team.acceptedCount || 0))
                  const effectiveMax = team.maxTeamSize ?? overview?.maxTeamSize

                  return (
                    <TableRow key={team.teamId} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      {/* Cột 1: NHÓM */}
                      <TableCell sx={{ py: 1.3, fontWeight: 700, color: '#0f172a' }}>
                        {team.teamName}
                      </TableCell>

                      {/* Cột 2: TRƯỞNG NHÓM */}
                      <TableCell sx={{ py: 1.3, color: '#334155' }}>
                        {team.leaderFullName || '—'}
                      </TableCell>

                      {/* Cột 3: THÀNH VIÊN */}
                      <TableCell align="center" sx={{ py: 1.3, fontWeight: 600 }}>
                        {effectiveMax != null ? `${team.acceptedCount}/${effectiveMax}` : `${team.acceptedCount} thành viên`}
                      </TableCell>

                      {/* Cột 4: LỜI MỜI CHỜ */}
                      <TableCell align="center" sx={{ py: 1.3, color: 'text.secondary' }}>
                        {team.pendingCount ?? 0}
                      </TableCell>

                      {/* Cột 5: TÌNH TRẠNG */}
                      <TableCell align="center" sx={{ py: 1.3 }}>
                        {team.isFull ? (
                          <Chip
                            label="Đủ người"
                            size="small"
                            sx={{
                              bgcolor: '#ecfdf5',
                              color: '#047857',
                              fontWeight: 700,
                              border: '1px solid #a7f3d0',
                              fontSize: 11,
                            }}
                          />
                        ) : team.isUnderMin ? (
                          <Chip
                            label={`Thiếu ${missingCount} người`}
                            size="small"
                            sx={{
                              bgcolor: '#fffbeb',
                              color: '#b45309',
                              fontWeight: 700,
                              border: '1px solid #fde68a',
                              fontSize: 11,
                            }}
                          />
                        ) : (
                          <Chip
                            label="Đạt tối thiểu"
                            size="small"
                            sx={{
                              bgcolor: '#f1f5f9',
                              color: '#475569',
                              fontWeight: 700,
                              border: '1px solid #cbd5e1',
                              fontSize: 11,
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Cột 6: ĐỀ TÀI */}
                      <TableCell align="center" sx={{ py: 1.3 }}>
                        {team.hasProject ? (
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a' }}>
                            Đã đăng ký
                          </Typography>
                        ) : (
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Chưa có
                          </Typography>
                        )}
                      </TableCell>

                      {/* Cột 7: ACTION */}
                      <TableCell align="right" sx={{ py: 1.3 }}>
                        {team.acceptedCount > 0 && (
                          <Button
                            size="small"
                            onClick={() => handleOpenMoveMemberModal(team)}
                            sx={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: 'primary.main',
                              textTransform: 'none',
                              p: 0,
                              minWidth: 'auto',
                              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                            }}
                          >
                            Thành viên
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ======================================================================
          KHỐI 5: CARD "SINH VIÊN CHƯA CÓ NHÓM ({unassignedCount})"
          ====================================================================== */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          borderColor: '#e2e8f0',
          bgcolor: '#ffffff',
        }}
      >
        {/* Header: Tiêu đề bên trái, nút xếp đã chọn bên phải */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
              onClick={() => setShowUnassigned((current) => !current)}
            >
              <ExpandMoreIcon
                sx={{ fontSize: 20, color: 'primary.main', transform: showUnassigned ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                Sinh viên chưa có nhóm ({unassignedCount})
              </Typography>
            </Box>
            {showUnassigned && unassignedStudents.length > 0 && (
              <Button
                size="small"
                onClick={handleToggleSelectAllStudents}
                sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', py: 0 }}
              >
                {selectedStudentIds.length === unassignedStudents.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </Button>
            )}
          </Box>

          <Button
            variant="contained"
            color="primary"
            size="small"
            disabled={selectedStudentIds.length === 0 || !isSettingsConfigured}
            onClick={handleOpenManualAssignModal}
            sx={{
              fontWeight: 700,
              borderRadius: 1.5,
              textTransform: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Xếp nhóm
          </Button>
        </Stack>

        {/* Body: Grid 2 cột danh sách checkbox thẻ SV, thu gọn được */}
        <Collapse in={showUnassigned} unmountOnExit>
        {unassignedStudents.length === 0 ? (
          <Alert severity="success" sx={{ my: 1 }}>
            Tất cả sinh viên trong lớp đã có nhóm.
          </Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 1.5,
            }}
          >
            {unassignedStudents.map((student) => {
              const isChecked = selectedStudentIds.includes(student.studentProfileId)

              return (
                <Paper
                  key={student.studentProfileId}
                  variant="outlined"
                  onClick={() => toggleStudentSelection(student.studentProfileId)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    cursor: 'pointer',
                    borderColor: isChecked ? 'primary.main' : '#e2e8f0',
                    bgcolor: isChecked ? '#f0f7ff' : '#ffffff',
                    transition: 'border-color 150ms ease, background-color 150ms ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: isChecked ? '#f0f7ff' : '#f8fafc',
                    },
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    size="small"
                    sx={{ p: 0.25 }}
                    inputProps={{ 'aria-label': student.fullName }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }} noWrap>
                      {student.fullName}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block' }}
                    >
                      {student.studentCode}
                    </Typography>
                  </Box>
                </Paper>
              )
            })}
          </Box>
        )}
        </Collapse>

        {/* Footer note */}
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 2, color: 'text.secondary', fontStyle: 'italic' }}
        >
          Lời mời đang chờ của bạn được xếp sẽ tự bị từ chối.
        </Typography>
      </Paper>

      {/* ======================================================================
          MODAL 1: TỰ XẾP (AUTO-ASSIGN PREVIEW)
          ====================================================================== */}
      {autoAssignOpen && (
        <AutoAssignDialog
          classId={classId}
          initialPreview={autoPreview}
          teams={teams}
          minTeamSize={overview.minTeamSize}
          maxTeamSize={overview.maxTeamSize}
          onClose={() => {
            setAutoAssignOpen(false)
            setAutoPreview(null)
          }}
          onDone={() => {
            setAutoAssignOpen(false)
            setAutoPreview(null)
            setAutoMessage({ severity: 'success', text: 'Đã chia nhóm.' })
            reload()
          }}
        />
      )}
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />

      {/* ======================================================================
          MODAL 2: CHUYỂN THÀNH VIÊN
          ====================================================================== */}
      <MoveMemberModal
        open={moveMemberOpen}
        onClose={() => setMoveMemberOpen(false)}
        classId={classId}
        sourceTeam={selectedTeamForMove}
        allTeams={teams}
        maxTeamSize={overview?.maxTeamSize}
        onSuccess={() => {
          setMoveMemberOpen(false)
          reload()
        }}
      />

      {/* ======================================================================
          MODAL 3: XẾP THỦ CÔNG
          ====================================================================== */}
      <ManualAssignModal
        open={manualAssignOpen}
        onClose={() => setManualAssignOpen(false)}
        classId={classId}
        selectedStudentIds={selectedStudentIds}
        selectedStudents={unassignedStudents.filter((s) =>
          selectedStudentIds.includes(s.studentProfileId)
        )}
        allTeams={teams}
        overviewMaxTeamSize={overview?.maxTeamSize}
        onSuccess={() => {
          setManualAssignOpen(false)
          reload()
        }}
      />
    </Stack>
  )
}

// =============================================================================
// MODAL 2: CHUYỂN THÀNH VIÊN (MoveMemberModal)
// =============================================================================
function MoveMemberModal({ open, onClose, classId, sourceTeam, allTeams, maxTeamSize, onSuccess }) {
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [targetTeamId, setTargetTeamId] = useState('')
  const [allowExceedMax, setAllowExceedMax] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reset khi mở/đổi nhóm nguồn
  useEffect(() => {
    if (!open) return
    setSelectedMemberId('')
    setTargetTeamId('')
    setAllowExceedMax(false)
    setError('')
  }, [open, sourceTeam])

  // Danh sách của BE chỉ gồm thành viên chính thức
  const acceptedMembers = sourceTeam?.members || []

  const eligibleTargets = sourceTeam?.projectApproved
    ? []
    : (allTeams || []).filter((t) => !t.projectApproved && t.teamId !== sourceTeam?.teamId)
  const isLeader = selectedMemberId !== '' && selectedMemberId === sourceTeam?.leaderId

  const targetTeam = eligibleTargets.find((t) => t.teamId === targetTeamId)
  const newTargetCount = targetTeam ? (targetTeam.acceptedCount || 0) + 1 : null
  const targetExceeds = maxTeamSize && newTargetCount > maxTeamSize

  const handleSubmit = async () => {
    if (!selectedMemberId || !targetTeamId) return
    setSubmitting(true)
    setError('')
    try {
      await moveMember(classId, {
        studentProfileId: selectedMemberId,
        targetTeamId,
        allowExceedMax,
      })
      onSuccess()
    } catch (err) {
      const msg =
        err?.cause?.response?.data?.message ||
        err?.response?.data?.message ||
        extractErrorMessage(err, 'Chuyển thành viên thất bại')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    setSubmitting(true)
    setError('')
    try {
      await removeTeamMember(classId, selectedMemberId)
      onSuccess()
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể đưa sinh viên ra khỏi nhóm.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        Thành viên{sourceTeam ? ` · ${sourceTeam.teamName}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {/* Chọn thành viên */}
          <FormControl size="small" fullWidth>
            <InputLabel>Thành viên</InputLabel>
            <Select
              label="Thành viên"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              {acceptedMembers.length === 0 ? (
                <MenuItem disabled value="">
                  Nhóm chưa có thành viên
                </MenuItem>
              ) : (
                acceptedMembers.map((m) => (
                  <MenuItem key={m.studentProfileId} value={m.studentProfileId}>
                    {m.fullName} ({m.studentCode}){m.studentProfileId === sourceTeam?.leaderId ? ' · trưởng nhóm' : ''}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {sourceTeam?.projectApproved && (
            <Alert severity="info">Đề tài của nhóm đã được duyệt: chỉ đưa bạn nghỉ học ra khỏi nhóm, không chuyển sang nhóm khác.</Alert>
          )}

          {/* Chọn nhóm đích */}
          <FormControl size="small" fullWidth disabled={Boolean(sourceTeam?.projectApproved)}>
            <InputLabel>Chuyển sang nhóm</InputLabel>
            <Select
              label="Chuyển sang nhóm"
              value={targetTeamId}
              onChange={(e) => {
                setTargetTeamId(e.target.value)
                setAllowExceedMax(false)
              }}
            >
              {eligibleTargets.length === 0 ? (
                <MenuItem disabled value="">
                  Không có nhóm đích hợp lệ
                </MenuItem>
              ) : (
                eligibleTargets.map((t) => {
                  const max = t.maxTeamSize ?? maxTeamSize
                  return (
                    <MenuItem key={t.teamId} value={t.teamId}>
                      {t.teamName} ({max != null ? `${t.acceptedCount}/${max}` : `${t.acceptedCount} thành viên`})
                    </MenuItem>
                  )
                })
              )}
            </Select>
          </FormControl>

          {/* Cảnh báo & checkbox vượt max */}
          {targetTeamId && targetExceeds && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={allowExceedMax}
                  onChange={(e) => setAllowExceedMax(e.target.checked)}
                  color="warning"
                />
              }
              label={
                <Typography variant="body2" sx={{ color: '#c2410c', fontWeight: 600 }}>
                  Nhóm đích sẽ có {newTargetCount}/{maxTeamSize} người — xác nhận cho phép vượt tối đa
                </Typography>
              }
            />
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          color="error"
          onClick={handleRemove}
          disabled={!selectedMemberId || isLeader || submitting}
          sx={{ mr: 'auto', textTransform: 'none' }}
        >
          Đưa ra khỏi nhóm
        </Button>
        <Button onClick={onClose} disabled={submitting}>
          Hủy
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={
            !selectedMemberId ||
            !targetTeamId ||
            submitting ||
            (targetExceeds && !allowExceedMax)
          }
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ fontWeight: 700, textTransform: 'none' }}
        >
          Chuyển
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// =============================================================================
// MODAL 3: XẾP THỦ CÔNG (ManualAssignModal)
// =============================================================================
function ManualAssignModal({
  open,
  onClose,
  classId,
  selectedStudentIds,
  selectedStudents,
  allTeams,
  overviewMaxTeamSize,
  onSuccess,
}) {
  // 'existing' | 'new' — mặc định luôn mở ở chế độ "Vào nhóm có sẵn"
  const [mode, setMode] = useState('existing')
  const [targetTeamId, setTargetTeamId] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [newLeaderId, setNewLeaderId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Đảm bảo luôn lấy danh sách id sinh viên chính xác từ selectedStudents hoặc selectedStudentIds
  const resolvedStudentProfileIds =
    selectedStudentIds && selectedStudentIds.length > 0
      ? selectedStudentIds
      : (selectedStudents || []).map((s) => s.studentProfileId)

  // Khi chỉ có 1 SV, tự động gán làm trưởng nhóm khi chuyển sang mode 'new'
  const isSingleStudent = (selectedStudents || []).length === 1

  useEffect(() => {
    if (!open) return
    setMode('existing')
    setTargetTeamId('')
    setNewTeamName('')
    // Nếu chỉ có 1 SV, pre-fill leader ngay từ đầu
    setNewLeaderId(isSingleStudent ? (selectedStudents[0]?.studentProfileId ?? '') : '')
    setError('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const eligibleTeams = allTeams || []

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    if (!resolvedStudentProfileIds || resolvedStudentProfileIds.length === 0) {
      setError('Chưa có sinh viên nào được chọn để xếp nhóm.')
      setSubmitting(false)
      return
    }

    try {
      let payload
      if (mode === 'existing') {
        if (!targetTeamId) {
          setError('Vui lòng chọn nhóm đích.')
          setSubmitting(false)
          return
        }
        payload = {
          existingTeams: [{ teamId: targetTeamId, studentProfileIds: resolvedStudentProfileIds }],
          newTeams: [],
          allowExceedMax: Boolean(false),
        }
      } else {
        if (!newTeamName.trim()) {
          setError('Vui lòng nhập tên nhóm mới.')
          setSubmitting(false)
          return
        }
        // Nếu 1 SV: tự động làm trưởng; nếu nhiều SV: dùng newLeaderId đã chọn
        const resolvedLeader = isSingleStudent
          ? (selectedStudents[0]?.studentProfileId ?? null)
          : newLeaderId || selectedStudents[0]?.studentProfileId
        payload = {
          existingTeams: [],
          newTeams: [
            {
              teamName: newTeamName.trim(),
              leaderStudentProfileId: resolvedLeader,
              studentProfileIds: resolvedStudentProfileIds,
            },
          ],
          allowExceedMax: Boolean(false),
        }
      }

      await assignTeams(classId, payload)
      onSuccess()
    } catch (err) {
      setError(extractErrorMessage(err, 'Xếp nhóm thất bại'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        Xếp thủ công {resolvedStudentProfileIds.length} sinh viên vào nhóm
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {/* Danh sách SV được chọn */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              Sinh viên được chọn
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.75}>
              {(selectedStudents || []).map((sv) => (
                <Chip
                  key={sv.studentProfileId}
                  label={`${sv.fullName} (${sv.studentCode})`}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
          </Box>

          {/* ——— Chế độ "Vào nhóm có sẵn" (mặc định) ——— */}
          {mode === 'existing' ? (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Chọn nhóm đích</InputLabel>
                <Select
                  label="Chọn nhóm đích"
                  value={targetTeamId}
                  onChange={(e) => setTargetTeamId(e.target.value)}
                >
                  {eligibleTeams.length === 0 ? (
                    <MenuItem disabled value="">
                      Lớp chưa có nhóm nào
                    </MenuItem>
                  ) : (
                    eligibleTeams.map((t) => {
                      const max = t.maxTeamSize ?? overviewMaxTeamSize
                      return (
                        <MenuItem key={t.teamId} value={t.teamId}>
                          {t.teamName} ({max != null ? `${t.acceptedCount}/${max}` : `${t.acceptedCount} thành viên`})
                        </MenuItem>
                      )
                    })
                  )}
                </Select>
              </FormControl>

              {/* Nút chuyển sang chế độ tạo nhóm mới */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setMode('new')
                    setError('')
                    // Pre-fill leader nếu chỉ có 1 SV
                    if (isSingleStudent) {
                      setNewLeaderId(selectedStudents[0]?.studentProfileId ?? '')
                    }
                  }}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  Tạo nhóm mới
                </Button>
              </Box>
            </>
          ) : (
            /* ——— Chế độ "Tạo nhóm mới" ——— */
            <>
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="Tên nhóm mới"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                />

                {/* Chỉ hiện dropdown trưởng nhóm khi có ≥ 2 SV được chọn */}
                {!isSingleStudent && (
                  <FormControl size="small" fullWidth>
                    <InputLabel>Trưởng nhóm</InputLabel>
                    <Select
                      label="Trưởng nhóm"
                      value={newLeaderId || selectedStudents[0]?.studentProfileId || ''}
                      onChange={(e) => setNewLeaderId(e.target.value)}
                    >
                      {selectedStudents.map((sv) => (
                        <MenuItem key={sv.studentProfileId} value={sv.studentProfileId}>
                          {sv.fullName} ({sv.studentCode})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Thông báo khi chỉ có 1 SV — tự động làm trưởng */}
                {isSingleStudent && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    {selectedStudents[0]?.fullName} sẽ tự động được gán làm Trưởng nhóm.
                  </Typography>
                )}
              </Stack>

              {/* Nút quay lại chế độ nhóm có sẵn */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    setMode('existing')
                    setError('')
                  }}
                  sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}
                >
                  ← Quay lại nhóm có sẵn
                </Button>
              </Box>
            </>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Hủy
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ fontWeight: 700, textTransform: 'none' }}
        >
          Áp dụng
        </Button>
      </DialogActions>
    </Dialog>
  )
}
