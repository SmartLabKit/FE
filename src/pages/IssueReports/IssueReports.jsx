import { useEffect, useState } from 'react'
import { ReportProblem as ReportIcon, Search as SearchIcon } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from '@mui/material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { issueReportService } from '../../services/issueReportService'
import CreateIssueReportDialog from './CreateIssueReportDialog'
import IssueReportDetailDialog from './IssueReportDetailDialog'
import { ISSUE_STATUSES, ISSUE_TYPES, formatDateTime, issueStatusOf, issueTypeLabel } from './issueReportLabels'

const PAGE_SIZE = 20
const headCellSx = { fontWeight: 700, color: '#334155' }

/**
 * Danh sách báo cáo sự cố thiết bị theo phạm vi role (BE tự giới hạn):
 * Student thấy báo cáo của mình, LabStaff thấy lab mình phụ trách, Lecturer thấy lớp mình dạy,
 * InventoryManager / Admin thấy tất cả. Lecturer chỉ xem, không được báo sự cố.
 */
export default function IssueReports() {
  const { hasRole } = useAuth()
  const canCreate = ['Student', 'LabStaff', 'InventoryManager', 'Admin'].some((role) => hasRole?.(role))
  const showFilters = ['LabStaff', 'InventoryManager', 'Admin', 'Lecturer'].some((role) => hasRole?.(role))

  const [status, setStatus] = useState('')
  const [issueType, setIssueType] = useState('')
  const [itemCodeInput, setItemCodeInput] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await issueReportService.getIssueReports({
          status: status || undefined,
          issueType: issueType || undefined,
          itemCode: itemCode || undefined,
          page,
          size: PAGE_SIZE,
        })
        if (active) setResult(data)
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [status, issueType, itemCode, page, reloadKey])

  const items = Array.isArray(result) ? result : result?.items || []
  const reload = () => setReloadKey((key) => key + 1)
  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity })

  const ACTION_MESSAGES = {
    Confirmed: 'Đã xác nhận sự cố.',
    Rejected: 'Đã từ chối báo cáo sự cố.',
    cancel: 'Đã hủy báo cáo sự cố.',
  }

  return (
    <PortalLayout headerTitle="Sự cố thiết bị" headerSubtitle="Báo và theo dõi thiết bị hư hỏng, cháy hoặc mất">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box
          sx={{
            p: 2,
            bgcolor: '#fff',
            border: '1px solid #d8dced',
            borderRadius: '6px 6px 0 0',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            {showFilters && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Loại sự cố"
                  value={issueType}
                  onChange={(event) => {
                    setIssueType(event.target.value)
                    setPage(1)
                  }}
                  sx={{ minWidth: 155 }}
                >
                  <MenuItem value="">Tất cả loại</MenuItem>
                  {ISSUE_TYPES.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </TextField>
                <Box
                  component="form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    setItemCode(itemCodeInput.trim())
                    setPage(1)
                  }}
                >
                  <TextField
                    size="small"
                    placeholder="Mã thiết bị (Enter để tìm)"
                    value={itemCodeInput}
                    onChange={(event) => setItemCodeInput(event.target.value)}
                    sx={{ minWidth: 230 }}
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                      },
                    }}
                  />
                </Box>
              </Box>
            )}
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<ReportIcon />}
                onClick={() => setCreateOpen(true)}
                sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
              >
                Báo sự cố
              </Button>
            )}
          </Box>

          {/* Dải nút lọc trạng thái sự cố 1 chạm đồng bộ Mobile */}
          {showFilters && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 1.5 }}>
              {[
                { value: '', label: 'Tất cả' },
                { value: 'Open', label: 'Đang mở' },
                ...ISSUE_STATUSES.filter((s) => s.value !== 'Open').map((s) => ({ value: s.value, label: s.label })),
              ].map((opt) => {
                const active = status === opt.value
                return (
                  <Button
                    key={opt.value || 'ALL'}
                    size="small"
                    variant={active ? 'contained' : 'outlined'}
                    onClick={() => {
                      setStatus(opt.value)
                      setPage(1)
                    }}
                    sx={{
                      textTransform: 'none',
                      borderRadius: '999px',
                      fontWeight: 700,
                      fontSize: 12,
                      px: 1.75,
                      py: 0.35,
                      boxShadow: 'none',
                      bgcolor: active ? '#0058be' : '#ffffff',
                      borderColor: active ? '#0058be' : '#cbd5e1',
                      color: active ? '#ffffff' : '#334155',
                      '&:hover': {
                        bgcolor: active ? '#0049a3' : '#f1f5f9',
                        borderColor: active ? '#0049a3' : '#94a3b8',
                      },
                    }}
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </Box>
          )}
        </Box>

        <Paper variant="outlined" sx={{ borderColor: '#d8dced', borderTop: 0, borderRadius: '0 0 6px 6px' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#faf9ff' }}>
                  {['Thời gian', 'Mã thiết bị', 'Linh kiện', 'Lab', 'Loại', 'Mô tả', 'Người báo', 'Trạng thái'].map((head) => (
                    <TableCell key={head} sx={headCellSx}>{head}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}><CircularProgress size={26} /></TableCell>
                  </TableRow>
                ) : items.map((report) => {
                  const reportStatus = issueStatusOf(report.status)
                  return (
                    <TableRow key={report.issueReportId} hover onClick={() => setSelectedId(report.issueReportId)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(report.createdAt)}</TableCell>
                      <TableCell sx={{ color: '#0058be', fontWeight: 600 }}>{report.itemCode || '—'}</TableCell>
                      <TableCell>{report.componentName || '—'}</TableCell>
                      <TableCell>{report.roomCode || '—'}</TableCell>
                      <TableCell>{issueTypeLabel(report.issueType)}</TableCell>
                      <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.description}</TableCell>
                      <TableCell>{report.reportedBy?.fullName || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" color={reportStatus.color} label={reportStatus.label} sx={{ fontWeight: 600, fontSize: 11 }} />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>Không có báo cáo sự cố nào.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={result?.totalCount || 0}
            page={page - 1}
            onPageChange={(_, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
          />
        </Paper>
      </Box>

      <CreateIssueReportDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          showToast('Đã gửi báo cáo sự cố, chờ Lab xử lý.')
          reload()
        }}
      />

      {selectedId && (
        <IssueReportDetailDialog
          issueReportId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={(kind) => {
            showToast(ACTION_MESSAGES[kind])
            reload()
          }}
        />
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
