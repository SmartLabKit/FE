import { useState, useEffect } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
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
  AutoAwesome as AutoAwesomeIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import {
  getTeamFormationOverview,
  updateTeamSettings,
} from '../../services/teamFormationApi'
import { extractErrorMessage } from '../../services/api'

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
 * Tuân thủ quy tắc nghiệp vụ:
 * 1. Không có nút/trạng thái "Mở chia nhóm" hay "Chốt nhóm" thủ công.
 * 2. Gọi getTeamFormationOverview(classId) duy nhất 1 lần khi mount để load toàn bộ dữ liệu.
 */
export default function TeamFormationTab({
  classId,
  onOpenAutoAssign,
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

  // Modal placeholders sẵn sàng cho Task 3
  const [autoAssignOpen, setAutoAssignOpen] = useState(false)
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

    const payload = {
      minTeamSize: min,
      maxTeamSize: max,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    }

    try {
      await updateTeamSettings(classId, payload)
      setSettingsSuccess('Lưu cấu hình nhóm thành công!')
      // Cập nhật lại state trực tiếp trên giao diện
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              minTeamSize: min,
              maxTeamSize: max,
              deadline: payload.deadline,
            }
          : null
      )
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

  // Xử lý mở các Modal (sẽ nối sang Task 3)
  const handleOpenAutoAssignModal = () => {
    if (onOpenAutoAssign) {
      onOpenAutoAssign()
    } else {
      setAutoAssignOpen(true)
    }
  }

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
              {overview.deadline
                ? `Sinh viên tự lập nhóm tới hạn chót ${formatDeadlineDisplay(overview.deadline)}`
                : 'Sinh viên tự lập nhóm (không giới hạn thời gian)'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mt: 0.75, maxWidth: 960, lineHeight: 1.5 }}>
              Lớp mới tạo là sinh viên tự tạo nhóm và mời nhau được ngay. Nhóm đủ số tối thiểu là đăng ký đề tài được.
              Bạn xếp các bạn còn lẻ hoặc chuyển người giữa các nhóm chưa có đề tài bất cứ lúc nào.
            </Typography>
          </Box>

          {/* Bên phải: Nút primary Tự xếp sinh viên còn lẻ */}
          {unassignedCount > 0 && (
            <Button
              variant="contained"
              color="primary"
              size="medium"
              startIcon={<AutoAwesomeIcon />}
              disabled={!isSettingsConfigured}
              onClick={handleOpenAutoAssignModal}
              sx={{
                whiteSpace: 'nowrap',
                fontWeight: 700,
                px: 2.5,
                py: 1,
                borderRadius: 1.75,
                textTransform: 'none',
                boxShadow: 'none',
                flexShrink: 0,
              }}
            >
              Tự xếp {unassignedCount} sinh viên còn lẻ
            </Button>
          )}
        </Stack>
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
            Số nhóm
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
            Nhóm dưới tối thiểu
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
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2, maxWidth: 960 }}>
          Chỉ lưu khi bấm &apos;Lưu cấu hình&apos; (PUT settings). Hết hạn chót thì sinh viên không tự đổi nhóm được nữa,
          bạn vẫn xếp và chuyển người được. Phải đặt số tối thiểu/tối đa thì mới xếp nhóm được.
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

            {/* Input 3: Hạn chót (không bắt buộc) */}
            <TextField
              size="small"
              label="Hạn chót (không bắt buộc)"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                input: {
                  endAdornment: deadline ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Xóa hạn chót"
                        onClick={() => setDeadline('')}
                        edge="end"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
              sx={{ width: { xs: '100%', md: 250 } }}
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
                        {team.acceptedCount}/{team.maxTeamSize}
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

                      {/* Cột 7: ACTION (Ẩn link nếu hasProject === true) */}
                      <TableCell align="right" sx={{ py: 1.3 }}>
                        {!team.hasProject && (
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
                            Chuyển thành viên
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
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
              Sinh viên chưa có nhóm ({unassignedCount})
            </Typography>
            {unassignedStudents.length > 0 && (
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
            Xếp đã chọn vào nhóm...
          </Button>
        </Stack>

        {/* Body: Grid 2 cột danh sách checkbox thẻ SV */}
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

        {/* Footer note */}
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 2, color: 'text.secondary', fontStyle: 'italic' }}
        >
          Chỉ xếp vào nhóm chưa có đề tài. Lời mời đang chờ của bạn được xếp sẽ tự bị từ chối.
        </Typography>
      </Paper>

      {/* Dialog Placeholders cho Task 3 nếu chưa truyền prop modal từ bên ngoài */}
      <Dialog open={autoAssignOpen} onClose={() => setAutoAssignOpen(false)}>
        <DialogTitle>Tự xếp sinh viên còn lẻ</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Modal Tự xếp sinh viên sẽ được kích hoạt tại Task 3.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoAssignOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moveMemberOpen} onClose={() => setMoveMemberOpen(false)}>
        <DialogTitle>Chuyển thành viên {selectedTeamForMove ? `· ${selectedTeamForMove.teamName}` : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Modal Chuyển thành viên giữa các nhóm sẽ được kích hoạt tại Task 3.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveMemberOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manualAssignOpen} onClose={() => setManualAssignOpen(false)}>
        <DialogTitle>Xếp thủ công vào nhóm</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Modal Xếp thủ công {selectedStudentIds.length} sinh viên đã chọn sẽ được kích hoạt tại Task 3.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualAssignOpen(false)}>Đóng</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
