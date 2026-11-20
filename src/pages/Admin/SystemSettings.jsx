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
  Tune as TuneIcon,
  Event as EventIcon,
  NotificationsActive as NotificationsActiveIcon,
  Groups as GroupsIcon,
  SettingsSuggest as SettingsSuggestIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { systemSettingService } from '../../services/systemSettingService'

/**
 * Cài đặt hệ thống (Admin).
 * - GET /api/system-settings: BE trả { key, value, description, updatedAt } cho mọi cấu hình được sửa (value = null khi chưa đặt).
 * - PUT /api/system-settings/{key} với body { value }.
 * Không có thêm / xóa cấu hình: mỗi khóa gắn với code BE. Tên, đơn vị, nhóm hiển thị khai báo ở SETTING_META;
 * khóa mới từ BE chưa có trong SETTING_META vẫn hiện (nhóm theo tiền tố, tên = key).
 */
const SETTING_META = {
  BORROW_DAYS_BEFORE_SEMESTER_END: {
    name: 'Hạn trả trước khi hết học kỳ',
    unit: 'ngày',
    min: 0,
    max: 365,
    fallback: 7,
  },
  BORROW_REMINDER_HOUR: {
    name: 'Giờ gửi email nhắc trả',
    unit: 'giờ',
    min: 0,
    max: 23,
    fallback: 7,
  },
  CLASS_MAX_STUDENTS_LIMIT: {
    name: 'Sĩ số tối đa của một lớp',
    unit: 'sinh viên',
    min: 1,
    max: 200,
    fallback: 35,
  },
  CLASS_DEFAULT_MAX_STUDENTS: {
    name: 'Sĩ số mặc định khi tạo lớp',
    unit: 'sinh viên',
    min: 1,
    fallback: 30,
  },
}

function groupOf(key) {
  if (key.startsWith('BORROW_REMINDER_')) return 'NOTIFICATION'
  if (key.startsWith('CLASS_')) return 'CLASS'
  return 'BORROW_RETURN'
}

function effectiveValue(setting) {
  if (!setting) return null
  if (setting.value !== null && setting.value !== undefined && setting.value !== '') return setting.value
  return setting.fallback ?? null
}

const SECTIONS = [
  {
    group: 'BORROW_RETURN',
    title: 'Cài đặt Mượn & Hoàn trả linh kiện (Borrow & Return Policies)',
    subtitle: 'Quy định về hạn trả linh kiện theo học kỳ',
    icon: <TuneIcon fontSize="small" />,
    color: '#0058be',
    bg: '#eff6ff',
  },
  {
    group: 'NOTIFICATION',
    title: 'Cấu hình Thông báo & Nhắc hạn (Notification & Reminders)',
    subtitle: 'Thời điểm tự động gửi email nhắc hạn cho sinh viên',
    icon: <NotificationsActiveIcon fontSize="small" />,
    color: '#9333ea',
    bg: '#faf5ff',
  },
  {
    group: 'CLASS',
    title: 'Cài đặt Lớp học (Class Settings)',
    subtitle: 'Sĩ số tối đa và sĩ số mặc định khi tạo lớp',
    icon: <GroupsIcon fontSize="small" />,
    color: '#059669',
    bg: '#ecfdf5',
  },
]

function StatCard({ icon, color, bg, caption, value }) {
  return (
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
            bgcolor: bg,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            {caption}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
            {value}
          </Typography>
        </Box>
      </Card>
    </Grid>
  )
}

function SettingSection({ section, items, onEdit, last }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        mb: last ? 0 : 4,
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
              bgcolor: section.bg,
              color: section.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {section.icon}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
              {section.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {section.subtitle}
            </Typography>
          </Box>
        </Box>

        <Chip
          label={`${items.length} cấu hình`}
          size="small"
          sx={{ bgcolor: section.bg, color: section.color, fontWeight: 700 }}
        />
      </Box>

      <TableContainer sx={{ border: '1px solid #f1f5f9', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>TÊN THAM SỐ & MÃ (KEY)</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>GIÁ TRỊ ÁP DỤNG</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>MÔ TẢ CHI TIẾT</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', py: 1.5 }}>
                THAO TÁC
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.key} hover>
                <TableCell sx={{ py: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {item.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: section.color,
                      fontFamily: 'monospace',
                      bgcolor: section.bg,
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
                      {effectiveValue(item) ?? '—'}
                    </Typography>
                    {item.unit && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.unit}
                      </Typography>
                    )}
                  </Box>
                  {item.isDefault && (
                    <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600 }}>
                      Chưa đặt – đang dùng mặc định
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ py: 2, color: '#475569', fontSize: 13, maxWidth: 420 }}>
                  {item.description}
                </TableCell>
                <TableCell align="right" sx={{ py: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                    onClick={() => onEdit(item)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 12,
                      borderRadius: 1,
                      borderColor: '#cbd5e1',
                      color: section.color,
                      whiteSpace: 'nowrap',
                      '&:hover': { borderColor: section.color, bgcolor: section.bg },
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
  )
}

export default function SystemSettings() {
  const [rawSettings, setRawSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedSetting, setSelectedSetting] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let isMounted = true
    systemSettingService
      .getSystemSettings()
      .then((data) => {
        if (isMounted) {
          setRawSettings(data)
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

  const settings = useMemo(
    () =>
      rawSettings.map((s) => {
        const meta = SETTING_META[s.key] || {}
        const hasValue = s.value !== null && s.value !== undefined && s.value !== ''
        return {
          ...s,
          ...meta,
          name: meta.name || s.key,
          group: groupOf(s.key),
          isDefault: !hasValue && meta.fallback !== undefined,
        }
      }),
    [rawSettings]
  )

  const byKey = (key) => settings.find((s) => s.key === key)

  const handleRefresh = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await systemSettingService.getSystemSettings()
      setRawSettings(data)
    } catch (err) {
      setErrorMsg(err.message || 'Không thể tải cài đặt hệ thống')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEdit = (setting) => {
    setSelectedSetting(setting)
    setEditValue(setting.value ?? '')
    setEditError('')
    setEditDialogOpen(true)
  }

  const handleCloseEdit = () => {
    if (saving) return
    setEditDialogOpen(false)
    setSelectedSetting(null)
  }

  const allowedMax = (setting) => {
    if (setting.key === 'CLASS_DEFAULT_MAX_STUDENTS') {
      return Number(effectiveValue(byKey('CLASS_MAX_STUDENTS_LIMIT')) ?? 200)
    }
    return setting.max
  }

  const checkValue = (setting, text) => {
    if (!/^-?\d+$/.test(String(text).trim())) return 'Giá trị phải là số nguyên'
    const num = Number(text)
    const max = allowedMax(setting)
    if (setting.min !== undefined && num < setting.min) return `Giá trị phải từ ${setting.min} đến ${max}`
    if (max !== undefined && num > max) return `Giá trị phải từ ${setting.min ?? 0} đến ${max}`
    if (setting.key === 'CLASS_MAX_STUDENTS_LIMIT') {
      const defaultSize = Number(effectiveValue(byKey('CLASS_DEFAULT_MAX_STUDENTS')))
      if (num < defaultSize) {
        return `Sĩ số tối đa không được nhỏ hơn sĩ số mặc định (${defaultSize}). Hãy giảm sĩ số mặc định trước`
      }
    }
    return ''
  }

  const handleSaveSetting = async () => {
    if (!selectedSetting) return

    const problem = checkValue(selectedSetting, editValue)
    if (problem) {
      setEditError(problem)
      return
    }

    try {
      setSaving(true)
      await systemSettingService.updateSystemSetting(selectedSetting.key, { value: String(Number(editValue)) })
      setToast({
        open: true,
        message: `Đã cập nhật cài đặt "${selectedSetting.name}" thành công!`,
        severity: 'success',
      })
      setSaving(false)
      handleCloseEdit()
      await handleRefresh()
    } catch (err) {
      setEditError(err.message || 'Cập nhật cài đặt thất bại')
      setSaving(false)
    }
  }

  const statValue = (key, suffix) => {
    const value = effectiveValue(byKey(key))
    if (value === null || value === undefined) return '—'
    return `${value}${suffix}`
  }

  const range = selectedSetting ? `${selectedSetting.min ?? 0}–${allowedMax(selectedSetting) ?? ''}` : ''

  return (
    <PortalLayout
      headerTitle="Cài đặt hệ thống"
      headerSubtitle="Cấu hình hạn trả, nhắc nhở và sĩ số lớp (Dành cho Admin)"
      currentRole="Quản trị viên"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto', py: 3 }}>
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <StatCard
            icon={<EventIcon />}
            color="#0058be"
            bg="#eff6ff"
            caption="HẠN TRẢ TRƯỚC HẾT KỲ"
            value={statValue('BORROW_DAYS_BEFORE_SEMESTER_END', ' ngày')}
          />
          <StatCard
            icon={<NotificationsActiveIcon />}
            color="#9333ea"
            bg="#faf5ff"
            caption="GIỜ NHẮC HẠN TRẢ"
            value={statValue('BORROW_REMINDER_HOUR', ':00 mỗi ngày')}
          />
          <StatCard
            icon={<GroupsIcon />}
            color="#059669"
            bg="#ecfdf5"
            caption="SĨ SỐ TỐI ĐA"
            value={statValue('CLASS_MAX_STUDENTS_LIMIT', ' sinh viên')}
          />
          <StatCard
            icon={<SettingsSuggestIcon />}
            color="#b45309"
            bg="#fef3c7"
            caption="SĨ SỐ MẶC ĐỊNH"
            value={statValue('CLASS_DEFAULT_MAX_STUDENTS', ' sinh viên')}
          />
        </Grid>

        <Box sx={{ mb: 2.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Danh sách tham số cấu hình hệ thống
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Tất cả thay đổi sẽ có hiệu lực tức thì cho các đơn mượn, thông báo và lớp được tạo mới
          </Typography>
        </Box>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {errorMsg}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          SECTIONS.map((section, index) => {
            const items = settings.filter((s) => s.group === section.group)
            if (items.length === 0) return null
            return (
              <SettingSection
                key={section.group}
                section={section}
                items={items}
                onEdit={handleOpenEdit}
                last={index === SECTIONS.length - 1}
              />
            )
          })
        )}

        <Dialog open={editDialogOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Chỉnh sửa cài đặt: {selectedSetting?.name}</DialogTitle>
          <DialogContent dividers>
            <DialogContentText sx={{ mb: 2.5, fontSize: 13 }}>
              Giá trị mới sẽ có hiệu lực ngay lập tức.
            </DialogContentText>

            <TextField
              label="Mã tham số (Key)"
              value={selectedSetting?.key || ''}
              fullWidth
              disabled
              size="small"
              sx={{ mb: 2 }}
            />

            <TextField
              label={`Giá trị mới (${range})`}
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value)
                setEditError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSetting()
              }}
              type="number"
              autoFocus
              fullWidth
              size="small"
              placeholder={selectedSetting?.fallback !== undefined ? `Mặc định ${selectedSetting.fallback}` : ''}
              error={Boolean(editError)}
              helperText={editError || (selectedSetting?.description ?? '')}
              InputProps={{
                endAdornment: selectedSetting?.unit ? (
                  <InputAdornment position="end">{selectedSetting.unit}</InputAdornment>
                ) : null,
              }}
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
              disabled={saving || String(editValue).trim() === ''}
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
