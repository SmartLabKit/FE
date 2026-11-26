import { useEffect, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography,
} from '@mui/material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useReport } from '../../hooks/useReport'
import { auditLogService } from '../../services/auditLogService'
import { userService } from '../../services/userService'

const PAGE_SIZE = 20
const HEADER_BG = '#1f3a5f'

const ACTIONS = [
  { value: 'LOGIN', label: 'Đăng nhập' },
  { value: 'CHANGE_PASSWORD', label: 'Đổi mật khẩu' },
  { value: 'RESET_PASSWORD', label: 'Đặt lại mật khẩu' },
  { value: 'ACTIVATE_USER', label: 'Kích hoạt thủ công' },
  { value: 'CREATE_USER', label: 'Tạo tài khoản' },
  { value: 'UPDATE_USER', label: 'Sửa tài khoản' },
  { value: 'ASSIGN_ROLES', label: 'Gán vai trò' },
  { value: 'ADD_PERMISSION', label: 'Thêm quyền' },
  { value: 'REMOVE_PERMISSION', label: 'Bỏ quyền' },
  { value: 'UPDATE_SETTING', label: 'Đổi cài đặt' },
]
const ACTION_LABELS = Object.fromEntries(ACTIONS.map((item) => [item.value, item.label]))

const SECTIONS = [
  { value: 'User', label: 'Tài khoản' },
  { value: 'Role', label: 'Vai trò & quyền' },
  { value: 'SystemSetting', label: 'Cài đặt hệ thống' },
]
const SECTION_LABELS = Object.fromEntries(SECTIONS.map((item) => [item.value, item.label]))

const PERIODS = [
  { value: '1', label: 'Hôm nay' },
  { value: '7', label: '7 ngày qua' },
  { value: '30', label: '30 ngày qua' },
  { value: '90', label: '90 ngày qua' },
  { value: 'all', label: 'Toàn bộ' },
  { value: 'custom', label: 'Tự chọn ngày' },
]

const FIELD_LABELS = {
  FullName: 'Họ tên',
  Email: 'Email',
  PhoneNumber: 'Số điện thoại',
  Username: 'Tên đăng nhập',
  Role: 'Vai trò',
  Roles: 'Vai trò',
  RoleName: 'Vai trò',
  Permission: 'Quyền',
  InstructorCode: 'Mã giảng viên',
  Value: 'Giá trị',
  Identifier: 'Tên đăng nhập / email',
  Reason: 'Lý do',
}

const EMPTY_FILTERS = { section: '', action: '', user: null, period: '7', fromDate: '', toDate: '', result: '' }

function toDayString(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function periodRange(filters) {
  if (filters.period === 'all') return {}
  if (filters.period === 'custom') return { fromDate: filters.fromDate || undefined, toDate: filters.toDate || undefined }
  const days = Number(filters.period)
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { fromDate: toDayString(from), toDate: toDayString(new Date()) }
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return { Value: value }
  }
}

const showValue = (value) => {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Câu mô tả ngắn cho cột "Hành động", giống "Created policy - Ruleset 2" của các trang audit log. */
function describe(log) {
  const before = parseJson(log.oldValue) || {}
  const after = parseJson(log.newValue) || {}
  switch (log.action) {
    case 'LOGIN':
      return log.isSuccess ? 'Đăng nhập' : `Đăng nhập thất bại${after.Reason ? `: ${after.Reason}` : ''}`
    case 'CHANGE_PASSWORD':
      return 'Đổi mật khẩu của chính mình'
    case 'RESET_PASSWORD':
      return 'Đặt lại mật khẩu cho tài khoản'
    case 'ACTIVATE_USER':
      return 'Kích hoạt thủ công, đặt mật khẩu tạm'
    case 'CREATE_USER':
      return `Tạo tài khoản ${after.Username || ''}${after.Role ? ` (${after.Role})` : ''}`.trim()
    case 'UPDATE_USER': {
      const changed = Object.keys(after).filter((key) => showValue(before[key]) !== showValue(after[key]))
      return changed.length
        ? `Sửa ${changed.map((key) => (FIELD_LABELS[key] || key).toLowerCase()).join(', ')}`
        : 'Sửa tài khoản (không đổi gì)'
    }
    case 'ASSIGN_ROLES':
      return `Gán vai trò: ${showValue(before.Roles)} → ${showValue(after.Roles)}`
    case 'ADD_PERMISSION':
      return `Thêm quyền ${after.Permission || ''} cho ${after.RoleName || 'vai trò'}`
    case 'REMOVE_PERMISSION':
      return `Bỏ quyền ${before.Permission || ''} khỏi ${before.RoleName || 'vai trò'}`
    case 'UPDATE_SETTING':
      return `Đổi ${log.entityId}: ${showValue(before.Value)} → ${showValue(after.Value)}`
    default:
      return ACTION_LABELS[log.action] || log.action
  }
}

const formatDay = (value) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const formatTime = (value) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function FilterLabel({ children }) {
  return <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155', mb: 0.5, mt: 1.5 }}>{children}</Typography>
}

/** Ô chọn người thực hiện, tìm theo tên / username (gọi GET /api/users, debounce 300ms). */
function UserPicker({ value, onChange }) {
  const [input, setInput] = useState('')
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const result = await userService.getUsers({ search: input.trim(), size: 20 })
        if (active) setOptions(result?.items || [])
      } catch {
        if (active) setOptions([])
      } finally {
        if (active) setLoading(false)
      }
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [input])

  return (
    <Autocomplete
      size="small"
      value={value}
      options={value && !options.some((item) => item.userId === value.userId) ? [value, ...options] : options}
      loading={loading}
      filterOptions={(items) => items}
      onChange={(_, next) => onChange(next)}
      onInputChange={(_, next, reason) => { if (reason === 'input') setInput(next) }}
      getOptionLabel={(option) => `${option.fullName || option.username} (${option.username})`}
      isOptionEqualToValue={(option, selected) => option.userId === selected.userId}
      noOptionsText="Không tìm thấy người dùng"
      renderInput={(params) => <TextField {...params} placeholder="Chọn người dùng" />}
    />
  )
}

function ValueDiff({ log }) {
  const before = parseJson(log.oldValue)
  const after = parseJson(log.newValue)
  if (!before && !after) {
    return <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Thao tác này không ghi giá trị cũ / mới.</Typography>
  }
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
  return (
    <Table size="small" sx={{ border: '1px solid #e4e6ef' }}>
      <TableHead>
        <TableRow sx={{ bgcolor: '#faf9ff' }}>
          <TableCell sx={{ fontWeight: 700 }}>Trường</TableCell>
          {before && <TableCell sx={{ fontWeight: 700 }}>Giá trị cũ</TableCell>}
          {after && <TableCell sx={{ fontWeight: 700 }}>Giá trị mới</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {keys.map((key) => {
          const changed = before && after && showValue(before[key]) !== showValue(after[key])
          return (
            <TableRow key={key} sx={changed ? { bgcolor: '#fff8e1' } : undefined}>
              <TableCell sx={{ color: '#424754' }}>{FIELD_LABELS[key] || key}</TableCell>
              {before && <TableCell sx={changed ? { color: '#c62828', textDecoration: 'line-through' } : undefined}>{showValue(before[key])}</TableCell>}
              {after && <TableCell sx={changed ? { color: '#2e7d32', fontWeight: 600 } : undefined}>{showValue(after[key])}</TableCell>}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function DetailRow({ label, children }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 0.75, borderBottom: '1px solid #eef0f6' }}>
      <Typography sx={{ width: 130, flexShrink: 0, fontSize: 13, color: '#697386' }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 13, color: '#131b2e', wordBreak: 'break-word', minWidth: 0 }}>{children}</Typography>
    </Box>
  )
}

/** Trang Nhật ký thao tác (Admin): bộ lọc bên trái, bảng log bên phải, bấm dòng xem chi tiết giá trị cũ / mới. */
export default function AuditLogs() {
  const [showFilters, setShowFilters] = useState(true)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)

  const query = {
    entityName: applied.section || undefined,
    action: applied.action || undefined,
    userId: applied.user?.userId,
    isSuccess: applied.result === '' ? undefined : applied.result === 'success',
    ...periodRange(applied),
  }
  const logs = useReport(() => auditLogService.getAuditLogs({ ...query, page, size: PAGE_SIZE }), [query, page])
  const rows = logs.data?.items || []

  const setField = (field) => (event) => setDraft((prev) => ({ ...prev, [field]: event.target.value }))
  const runFilter = () => {
    setApplied(draft)
    setPage(1)
  }
  const clearFilter = () => {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setPage(1)
  }
  const customInvalid = draft.period === 'custom' && draft.fromDate && draft.toDate && draft.fromDate > draft.toDate

  return (
    <PortalLayout headerTitle="Nhật ký thao tác" headerSubtitle="Ai đã làm gì, lúc nào, từ đâu: đăng nhập, tài khoản, vai trò, quyền và cài đặt">
      <Box sx={{ maxWidth: 1440, mx: 'auto', display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
        <Paper variant="outlined" sx={{ width: { xs: '100%', md: showFilters ? 280 : 'auto' }, flexShrink: 0, borderColor: '#d8dced', overflow: 'hidden' }}>
          <Box sx={{ bgcolor: HEADER_BG, color: '#fff', px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Bộ lọc</Typography>
            <Button size="small" onClick={() => setShowFilters((prev) => !prev)} sx={{ color: '#fff', textTransform: 'none', minWidth: 0, p: 0 }}>
              {showFilters ? 'Ẩn' : 'Hiện'}
            </Button>
          </Box>
          {showFilters && (
            <Box sx={{ p: 2, pt: 0.5 }}>
              <FilterLabel>Lọc theo nhóm</FilterLabel>
              <TextField select fullWidth size="small" value={draft.section} onChange={setField('section')} slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Tất cả nhóm</MenuItem>
                {SECTIONS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </TextField>

              <FilterLabel>Lọc theo hành động</FilterLabel>
              <TextField select fullWidth size="small" value={draft.action} onChange={setField('action')} slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Tất cả hành động</MenuItem>
                {ACTIONS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </TextField>

              <FilterLabel>Lọc theo người thực hiện</FilterLabel>
              <UserPicker value={draft.user} onChange={(user) => setDraft((prev) => ({ ...prev, user }))} />

              <FilterLabel>Lọc theo thời gian</FilterLabel>
              <TextField select fullWidth size="small" value={draft.period} onChange={setField('period')}>
                {PERIODS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </TextField>
              {draft.period === 'custom' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
                  <TextField type="date" size="small" label="Từ ngày" value={draft.fromDate} onChange={setField('fromDate')} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField type="date" size="small" label="Đến ngày" value={draft.toDate} onChange={setField('toDate')} slotProps={{ inputLabel: { shrink: true } }} />
                </Box>
              )}

              <FilterLabel>Lọc theo kết quả</FilterLabel>
              <TextField select fullWidth size="small" value={draft.result} onChange={setField('result')} slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="success">Thành công</MenuItem>
                <MenuItem value="failed">Thất bại</MenuItem>
              </TextField>

              {customInvalid && <Alert severity="warning" sx={{ mt: 1.5, py: 0 }}>Từ ngày phải trước đến ngày.</Alert>}
              <Button fullWidth variant="contained" disableElevation onClick={runFilter} disabled={customInvalid} sx={{ mt: 2.5, textTransform: 'none', fontWeight: 700 }}>
                Lọc
              </Button>
              <Button fullWidth size="small" onClick={clearFilter} sx={{ mt: 1, textTransform: 'none' }}>
                Xóa bộ lọc
              </Button>
            </Box>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ flexGrow: 1, minWidth: 0, width: '100%', borderColor: '#d8dced', overflow: 'hidden' }}>
          {logs.error ? (
            <Alert severity="error" sx={{ m: 2 }}>{logs.error}</Alert>
          ) : (
            <>
              <TableContainer sx={{ position: 'relative' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: HEADER_BG }}>
                      {['Ngày', 'Giờ', 'Địa chỉ IP', 'Người thực hiện', 'Nhóm', 'Hành động'].map((label) => (
                        <TableCell key={label} sx={{ color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((log) => (
                      <TableRow key={log.auditLogId} hover onClick={() => setSelected(log)} sx={{ cursor: 'pointer', '&:nth-of-type(even)': { bgcolor: '#f7f9fc' } }}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDay(log.createdAt)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: '#697386' }}>{formatTime(log.createdAt)}</TableCell>
                        <TableCell sx={{ fontFamily: 'Consolas, monospace', fontSize: 12.5 }}>{log.ipAddress || '—'}</TableCell>
                        <TableCell>
                          {log.fullName || log.username || <Box component="span" sx={{ color: 'text.secondary' }}>Không xác định</Box>}
                          {log.username && log.fullName && <Box component="span" sx={{ display: 'block', color: '#697386', fontSize: 12 }}>{log.username}</Box>}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{SECTION_LABELS[log.entityName] || log.entityName}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Box component="span" sx={{ color: log.isSuccess ? '#0058be' : '#c62828', fontWeight: 600 }}>{describe(log)}</Box>
                            {!log.isSuccess && <Chip size="small" color="error" label="Thất bại" sx={{ height: 20, fontSize: 11 }} />}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!logs.loading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>Không có thao tác nào khớp bộ lọc.</TableCell>
                      </TableRow>
                    )}
                    {logs.loading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress size={26} /></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={logs.data?.totalCount || 0}
                page={page - 1}
                onPageChange={(_, next) => setPage(next + 1)}
                rowsPerPage={PAGE_SIZE}
                rowsPerPageOptions={[PAGE_SIZE]}
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
              />
            </>
          )}
        </Paper>
      </Box>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        {selected && (
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
              {ACTION_LABELS[selected.action] || selected.action}
              <Chip
                size="small"
                color={selected.isSuccess ? 'success' : 'error'}
                label={selected.isSuccess ? 'Thành công' : 'Thất bại'}
                sx={{ ml: 1, verticalAlign: 'middle' }}
              />
            </DialogTitle>
            <DialogContent dividers>
              <DetailRow label="Thời gian">{formatDay(selected.createdAt)} {formatTime(selected.createdAt)}</DetailRow>
              <DetailRow label="Người thực hiện">
                {selected.fullName || selected.username || 'Không xác định'}
                {selected.username ? ` (${selected.username})` : ''}
              </DetailRow>
              <DetailRow label="Nhóm">{SECTION_LABELS[selected.entityName] || selected.entityName}</DetailRow>
              <DetailRow label="Mã đối tượng">
                <Box component="span" sx={{ fontFamily: 'Consolas, monospace', fontSize: 12.5 }}>{selected.entityId || '—'}</Box>
              </DetailRow>
              <DetailRow label="Địa chỉ IP">{selected.ipAddress || '—'}</DetailRow>
              <DetailRow label="Trình duyệt">
                <Box component="span" sx={{ fontSize: 12, color: '#424754' }}>{selected.userAgent || '—'}</Box>
              </DetailRow>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mt: 2, mb: 1 }}>{describe(selected)}</Typography>
              <ValueDiff log={selected} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none' }}>Đóng</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </PortalLayout>
  )
}
