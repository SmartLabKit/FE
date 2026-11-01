import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
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
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Tune as TuneIcon,
  Schedule as ScheduleIcon,
  NotificationsActive as NotificationsActiveIcon,
  LocationOn as LocationOnIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { systemSettingService } from '../../services/systemSettingService'

/**
 * SystemSettings Component (Actor: Quản trị viên / Admin)
 * Quản lý các cấu hình hệ thống:
 * - GET /api/system-settings
 * - PUT /api/system-settings/{key}
 */
export default function SystemSettings() {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // State modal chỉnh sửa cài đặt
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedSetting, setSelectedSetting] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Tải danh sách cài đặt khi mount mà không kích hoạt setState đồng bộ trong effect
  useEffect(() => {
    let isMounted = true
    systemSettingService
      .getSystemSettings()
      .then((data) => {
        if (isMounted) {
          setSettings(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err.message || 'Không thể tải cài đặt hệ thống')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Nút làm mới dữ liệu
  const handleRefresh = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await systemSettingService.getSystemSettings()
      setSettings(data)
    } catch (err) {
      setErrorMsg(err.message || 'Không thể tải cài đặt hệ thống')
    } finally {
      setLoading(false)
    }
  }

  // Mở modal sửa cài đặt
  const handleOpenEdit = (setting) => {
    setSelectedSetting(setting)
    setEditValue(setting.value || '')
    setEditDescription(setting.description || '')
    setEditDialogOpen(true)
  }

  // Đóng modal
  const handleCloseEdit = () => {
    if (saving) return
    setEditDialogOpen(false)
    setSelectedSetting(null)
  }

  // Lưu cài đặt (PUT /api/system-settings/{key})
  const handleSaveSetting = async () => {
    if (!selectedSetting) return

    // Validation cơ bản theo kiểu dữ liệu
    if (selectedSetting.dataType === 'number') {
      const num = Number(editValue)
      if (isNaN(num)) {
        setToast({ open: true, message: 'Giá trị phải là chữ số hợp lệ', severity: 'warning' })
        return
      }
      if (selectedSetting.min !== undefined && num < selectedSetting.min) {
        setToast({
          open: true,
          message: `Giá trị tối thiểu cho cài đặt này là ${selectedSetting.min}`,
          severity: 'warning',
        })
        return
      }
      if (selectedSetting.max !== undefined && num > selectedSetting.max) {
        setToast({
          open: true,
          message: `Giá trị tối đa cho cài đặt này là ${selectedSetting.max}`,
          severity: 'warning',
        })
        return
      }
    } else if (!editValue.trim()) {
      setToast({ open: true, message: 'Giá trị không được để trống', severity: 'warning' })
      return
    }

    try {
      setSaving(true)
      await systemSettingService.updateSystemSetting(selectedSetting.key, {
        value: editValue.trim(),
        description: editDescription.trim(),
      })

      setToast({
        open: true,
        message: `Đã cập nhật cài đặt "${selectedSetting.name || selectedSetting.key}" thành công!`,
        severity: 'success',
      })
      handleCloseEdit()
      await handleRefresh()
    } catch (err) {
      setToast({
        open: true,
        message: err.message || 'Cập nhật cài đặt thất bại',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  // Phân loại nhóm cài đặt
  const borrowSettings = useMemo(
    () => settings.filter((s) => s.group === 'BORROW_RETURN'),
    [settings]
  )

  const notificationSettings = useMemo(
    () => settings.filter((s) => s.group === 'NOTIFICATION' || s.group === 'GENERAL'),
    [settings]
  )

  // Danh sách phòng lab gợi ý cho PICKUP_ROOM_ID
  const SUGGESTED_ROOMS = [
    'B1-302 · Phòng thực hành IoT',
    'A2-105 · Phòng Vi điều khiển & Nhúng',
    'C3-201 · Lab Robotics & Tự động hóa',
    'E4-402 · Xưởng Cơ điện tử',
  ]

  return (
    <PortalLayout
      headerTitle="Cài đặt hệ thống"
      headerSubtitle="Cấu hình thông số mượn/trả, phòng nhận đồ, thời hạn và nhắc nhở (Dành cho Admin)"
      currentRole="Quản trị viên"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto', py: 3 }}>
        {/* Banner tóm tắt thông số cấu hình chính */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: '#eff6ff',
                  color: '#0058be',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LocationOnIcon />
              </Box>
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  LAB BÀN GIAO & TRẢ
                </Typography>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {settings.find((s) => s.key === 'PICKUP_ROOM_ID')?.value || 'B1-302'}
                </Typography>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ScheduleIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  HẠN MƯỢN TỐI ĐA
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {settings.find((s) => s.key === 'BORROW_MAX_DAYS')?.value || '14'} ngày
                </Typography>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: '#fef3c7',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TuneIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  SỐ LẦN GIA HẠN
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {settings.find((s) => s.key === 'MAX_EXTENSIONS')?.value || '2'} lần tối đa
                </Typography>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid #e2e8f0',
                borderRadius: 2,
                bgcolor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: '#faf5ff',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <NotificationsActiveIcon />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  NHẮC HẠN TRẢ
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  Trước {settings.find((s) => s.key === 'REMINDER_HOURS')?.value || '24'} giờ
                </Typography>
              </Box>
            </Card>
          </Grid>
        </Grid>

        {/* Thanh tiêu đề & Tải lại */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2.5,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
              Danh sách tham số cấu hình hệ thống
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Tất cả thay đổi sẽ có hiệu lực tức thì cho các đơn mượn và thông báo được tạo mới
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 1.5,
              borderColor: '#cbd5e1',
              color: '#334155',
            }}
          >
            Làm mới dữ liệu
          </Button>
        </Box>

        {/* Alert lỗi nếu có */}
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {errorMsg}
          </Alert>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Nhóm 1: Cài đặt Quy trình Mượn & Trả linh kiện */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                mb: 4,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                  pb: 1.5,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      bgcolor: '#eff6ff',
                      color: '#0058be',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TuneIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      Cài đặt Mượn & Hoàn trả linh kiện (Borrow & Return Policies)
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Quy định về thời hạn, phòng tiếp nhận, gia hạn và hủy đơn
                    </Typography>
                  </Box>
                </Box>

                <Chip
                  label={`${borrowSettings.length} cấu hình`}
                  size="small"
                  sx={{ bgcolor: '#eff6ff', color: '#0058be', fontWeight: 700 }}
                />
              </Box>

              <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        TÊN THAM SỐ & MÃ (KEY)
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        GIÁ TRỊ ÁP DỤNG
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        MÔ TẢ CHI TIẾT
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        THAO TÁC
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {borrowSettings.map((item) => (
                      <TableRow key={item.key} hover>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                            {item.name || item.key}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#0058be',
                              fontFamily: 'monospace',
                              bgcolor: '#eff6ff',
                              px: 0.8,
                              py: 0.2,
                              borderRadius: 0.8,
                              fontWeight: 600,
                            }}
                          >
                            {item.key}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              {item.value}
                            </Typography>
                            {item.unit && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {item.unit}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 2, color: '#475569', fontSize: 13, maxWidth: 420 }}>
                          {item.description}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 2 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                            onClick={() => handleOpenEdit(item)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 12,
                              borderRadius: 1,
                              borderColor: '#cbd5e1',
                              color: '#0058be',
                              '&:hover': { borderColor: '#0058be', bgcolor: '#eff6ff' },
                            }}
                          >
                            Chỉnh sửa
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Nhóm 2: Cài đặt Thông báo & Nhắc hạn */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                  pb: 1.5,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      bgcolor: '#faf5ff',
                      color: '#9333ea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <NotificationsActiveIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      Cấu hình Thông báo & Nhắc hạn (Notification & Reminders)
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Khoảng thời gian tự động kích hoạt thông báo nhắc hạn cho sinh viên
                    </Typography>
                  </Box>
                </Box>

                <Chip
                  label={`${notificationSettings.length} cấu hình`}
                  size="small"
                  sx={{ bgcolor: '#faf5ff', color: '#9333ea', fontWeight: 700 }}
                />
              </Box>

              <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        TÊN THAM SỐ & MÃ (KEY)
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        GIÁ TRỊ ÁP DỤNG
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        MÔ TẢ CHI TIẾT
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                        THAO TÁC
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {notificationSettings.map((item) => (
                      <TableRow key={item.key} hover>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                            {item.name || item.key}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#9333ea',
                              fontFamily: 'monospace',
                              bgcolor: '#faf5ff',
                              px: 0.8,
                              py: 0.2,
                              borderRadius: 0.8,
                              fontWeight: 600,
                            }}
                          >
                            {item.key}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              {item.value}
                            </Typography>
                            {item.unit && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {item.unit}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 2, color: '#475569', fontSize: 13, maxWidth: 420 }}>
                          {item.description}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 2 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                            onClick={() => handleOpenEdit(item)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 12,
                              borderRadius: 1,
                              borderColor: '#cbd5e1',
                              color: '#9333ea',
                              '&:hover': { borderColor: '#9333ea', bgcolor: '#faf5ff' },
                            }}
                          >
                            Chỉnh sửa
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}

        {/* Modal Dialog chỉnh sửa cài đặt */}
        <Dialog open={editDialogOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
            Chỉnh sửa cài đặt: {selectedSetting?.name || selectedSetting?.key}
          </DialogTitle>
          <DialogContent dividers>
            <DialogContentText sx={{ mb: 2.5, fontSize: 13 }}>
              Cập nhật tham số hệ thống qua API{' '}
              <Typography
                component="span"
                sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#0058be' }}
              >
                PUT /api/system-settings/{selectedSetting?.key}
              </Typography>
              . Giá trị mới sẽ có hiệu lực ngay lập tức.
            </DialogContentText>

            {/* Key hiển thị cố định */}
            <TextField
              label="Mã tham số (Key)"
              value={selectedSetting?.key || ''}
              fullWidth
              disabled
              size="small"
              sx={{ mb: 2 }}
            />

            {/* Input giá trị */}
            {selectedSetting?.key === 'PICKUP_ROOM_ID' ? (
              <Box sx={{ mb: 2 }}>
                <TextField
                  select
                  label="Phòng nhận đồ gợi ý"
                  value={SUGGESTED_ROOMS.includes(editValue) ? editValue : ''}
                  onChange={(e) => setEditValue(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mb: 1.5 }}
                >
                  {SUGGESTED_ROOMS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Hoặc nhập tên phòng cụ thể"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Tên phòng và vị trí bàn giao hiển thị cho sinh viên khi tạo đơn"
                />
              </Box>
            ) : (
              <TextField
                label={`Giá trị tham số ${selectedSetting?.unit ? `(${selectedSetting.unit})` : ''}`}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                type={selectedSetting?.dataType === 'number' ? 'number' : 'text'}
                fullWidth
                size="small"
                inputProps={{
                  min: selectedSetting?.min,
                  max: selectedSetting?.max,
                }}
                InputProps={{
                  endAdornment: selectedSetting?.unit ? (
                    <InputAdornment position="end">{selectedSetting.unit}</InputAdornment>
                  ) : null,
                }}
                helperText={
                  selectedSetting?.min !== undefined && selectedSetting?.max !== undefined
                    ? `Khoảng hợp lệ: từ ${selectedSetting.min} đến ${selectedSetting.max} ${selectedSetting.unit || ''}`
                    : undefined
                }
                sx={{ mb: 2 }}
              />
            )}

            {/* Input mô tả */}
            <TextField
              label="Mô tả / Ghi chú mục đích của tham số"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={handleCloseEdit}
              disabled={saving}
              sx={{ textTransform: 'none', fontWeight: 600, color: '#64748b' }}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveSetting}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              sx={{
                bgcolor: '#0058be',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
                px: 2.5,
                '&:hover': { bgcolor: '#00479e' },
              }}
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar Toast */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast((prev) => ({ ...prev, open: false }))}
            sx={{ borderRadius: 1.5, fontWeight: 600 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Container>
    </PortalLayout>
  )
}
