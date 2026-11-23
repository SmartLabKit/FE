import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassIcon,
  Cancel as CancelIcon,
  Update as UpdateIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import ProjectApprovalDialog from './ProjectApprovalDialog'
import ProjectStatusChip from '../../components/borrowing/ProjectStatusChip'
import { borrowService } from '../../services/borrowService'
import { projectService } from '../../services/projectService'
import { useAuth } from '../../context/AuthContext'
import { formatVietnamDate } from '../../utils/dateFormatting'
import { getBorrowRequestStatusMeta } from './borrowHelpers'

const ACTIVE_BORROW_STATUSES = ['Pending', 'PendingApproval', 'PendingLecturer', 'Submitted', 'Approved', 'Ready', 'Borrowing']
const HISTORY_BORROW_STATUSES = ['Returned', 'Cancelled', 'Rejected']

function isRequestOverdue(borrow) {
  if (!borrow) return false
  if (borrow.status === 'Overdue') return true
  return Boolean(borrow.isOverdue) && !HISTORY_BORROW_STATUSES.includes(borrow.status)
}

function addDaysToIso(dateValue, days) {
  const base = dateValue ? new Date(dateValue) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  const next = new Date(base.getTime() + Number(days || 0) * 86400000)
  return next.toISOString()
}

function getExtensionDays(oldDueDate, newDueDate, fallbackDays) {
  if (oldDueDate && newDueDate) {
    const start = new Date(oldDueDate)
    const end = new Date(newDueDate)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diff = Math.round((end.getTime() - start.getTime()) / 86400000)
      if (diff > 0) return diff
    }
  }
  return fallbackDays || null
}

/**
 * SupplementaryBorrowList Component
 * Danh sách Đơn mượn, Mượn bổ sung (MF5.1) & Quản lý Gia hạn (Extensions)
 */
export default function SupplementaryBorrowList() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const isLecturer = user?.roleLabel === 'LECTURER' || user?.roles?.includes('Lecturer')

  const [supplementaryRequests, setSupplementaryRequests] = useState([])
  const [borrowRequests, setBorrowRequests] = useState([])
  const [loadingStudentData, setLoadingStudentData] = useState(false)
  const [studentDataError, setStudentDataError] = useState('')
  const [borrowStatusFilter, setBorrowStatusFilter] = useState('all') // 'all' | 'active' | 'overdue' | 'history'
  const [borrowSearch, setBorrowSearch] = useState('')
  const [extensions, setExtensions] = useState([])
  const [lecturerProjects, setLecturerProjects] = useState([])
  const [loadingLecturerProjects, setLoadingLecturerProjects] = useState(false)
  const [lecturerProjectsError, setLecturerProjectsError] = useState('')
  const [projectStatusFilter, setProjectStatusFilter] = useState('all') // 'all' | 'Submitted' | 'Approved' | 'Rejected'
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // State Modal xin gia hạn (POST /api/borrow-requests/{id}/extensions)
  const [extDialogOpen, setExtDialogOpen] = useState(false)
  const [selectedBorrow, setSelectedBorrow] = useState(null)
  const [requestedDays, setRequestedDays] = useState(7)
  const [extReason, setExtReason] = useState('')
  const [extSubmitting, setExtSubmitting] = useState(false)

  // State Modal từ chối gia hạn (POST /api/borrow-extensions/{extensionId}/reject)
  const [rejectExtDialogOpen, setRejectExtDialogOpen] = useState(false)
  const [selectedExt, setSelectedExt] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  // Hàm tải toàn bộ dữ liệu theo vai trò (Sinh viên vs Giảng viên)
  const loadData = useCallback(async () => {
    if (isLecturer) {
      setLoadingLecturerProjects(true)
      try {
        const [projects, extData] = await Promise.all([
          projectService.getLecturerProjects(),
          borrowService.getBorrowExtensions({ page: 1, size: 100 }).catch(() => ({ items: [] })),
        ])
        setLecturerProjects(Array.isArray(projects) ? projects : [])
        setLecturerProjectsError('')
        const extItems = Array.isArray(extData) ? extData : extData?.items || extData?.data?.items || []
        setExtensions(extItems)
      } catch (err) {
        setLecturerProjectsError(err.message || 'Không thể tải danh sách project của sinh viên.')
      } finally {
        setLoadingLecturerProjects(false)
      }
      return
    }

    setLoadingStudentData(true)
    setStudentDataError('')
    try {
      const overview = await borrowService.getStudentBorrowOverview({ includeExtensions: true })
      setBorrowRequests(overview.borrowRequests || [])
      setSupplementaryRequests(overview.supplementaryRequests || [])
      setExtensions(overview.extensions || [])
      if (overview.error) {
        setStudentDataError(overview.error)
      }
    } catch (err) {
      setStudentDataError(err.message || 'Không thể tải danh sách đơn mượn của bạn.')
    } finally {
      setLoadingStudentData(false)
    }
  }, [isLecturer])

  // Tải dữ liệu ban đầu và khi tài khoản đăng nhập thay đổi
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (active) loadData()
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [loadData, user?.userId])

  const refreshData = useCallback(async () => {
    await loadData()
  }, [loadData])

  // Thống kê số lượng project theo trạng thái cho Giảng viên (bao gồm cả đề tài đã Approved nhưng có đơn mượn thêm Pending)
  const pendingCount = useMemo(
    () =>
      lecturerProjects.filter(
        (p) =>
          ['Submitted', 'PendingApproval', 'PendingLecturer', 'Pending'].includes(p.status) ||
          Boolean(p.hasPendingApproval) ||
          Boolean(p.isSupplementary)
      ).length,
    [lecturerProjects]
  )

  const approvedCount = useMemo(
    () => lecturerProjects.filter((p) => p.status === 'Approved').length,
    [lecturerProjects]
  )

  const rejectedCount = useMemo(
    () => lecturerProjects.filter((p) => p.status === 'Rejected').length,
    [lecturerProjects]
  )

  // Danh sách project đã lọc
  const filteredLecturerProjects = useMemo(() => {
    return lecturerProjects.filter((project) => {
      // Lọc trạng thái
      if (projectStatusFilter === 'Submitted') {
        const isPendingItem =
          ['Submitted', 'PendingApproval', 'PendingLecturer', 'Pending'].includes(project.status) ||
          Boolean(project.hasPendingApproval) ||
          Boolean(project.isSupplementary)
        if (!isPendingItem) return false
      } else if (projectStatusFilter === 'Approved') {
        if (project.status !== 'Approved') return false
      } else if (projectStatusFilter === 'Rejected') {
        if (project.status !== 'Rejected') return false
      }

      // Tìm kiếm từ khóa
      if (projectSearch.trim()) {
        const q = projectSearch.toLowerCase().trim()
        const matchTitle = project.title?.toLowerCase().includes(q)
        const matchCode = (project.pendingRequestCode || project.requestCode || '').toLowerCase().includes(q)
        const matchOwner = project.ownerName?.toLowerCase().includes(q)
        const matchTeam = project.teamName?.toLowerCase().includes(q)
        const matchClass = project.classCode?.toLowerCase().includes(q)
        if (!matchTitle && !matchCode && !matchOwner && !matchTeam && !matchClass) {
          return false
        }
      }

      return true
    })
  }, [lecturerProjects, projectStatusFilter, projectSearch])

  // Thống kê đơn mượn của sinh viên theo nhóm trạng thái (đồng bộ với Mobile: Đang xử lý / Quá hạn / Lịch sử)
  const studentBorrowCounts = useMemo(() => {
    const active = borrowRequests.filter(
      (b) => ACTIVE_BORROW_STATUSES.includes(b.status) && !isRequestOverdue(b)
    ).length
    const overdue = borrowRequests.filter((b) => isRequestOverdue(b)).length
    const history = borrowRequests.filter((b) => HISTORY_BORROW_STATUSES.includes(b.status)).length
    return {
      all: borrowRequests.length,
      active,
      overdue,
      history,
    }
  }, [borrowRequests])

  const filteredBorrowRequests = useMemo(() => {
    return borrowRequests.filter((b) => {
      if (borrowStatusFilter === 'active') {
        if (!ACTIVE_BORROW_STATUSES.includes(b.status) || isRequestOverdue(b)) return false
      } else if (borrowStatusFilter === 'overdue') {
        if (!isRequestOverdue(b)) return false
      } else if (borrowStatusFilter === 'history') {
        if (!HISTORY_BORROW_STATUSES.includes(b.status)) return false
      }

      if (borrowSearch.trim()) {
        const q = borrowSearch.toLowerCase().trim()
        const matchCode = b.requestCode?.toLowerCase().includes(q)
        const matchTitle = b.projectTitle?.toLowerCase().includes(q)
        const matchClass = b.classCode?.toLowerCase().includes(q)
        const matchRoom = (b.roomName || b.roomCode || '').toLowerCase().includes(q)
        if (!matchCode && !matchTitle && !matchClass && !matchRoom) return false
      }

      return true
    })
  }, [borrowRequests, borrowStatusFilter, borrowSearch])

  const getProjectStatusChip = (status) => <ProjectStatusChip status={status} />

  const getExtensionStatusChip = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <Chip
            icon={<HourglassIcon sx={{ fontSize: '14px !important' }} />}
            label="Chờ duyệt gia hạn"
            size="small"
            sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
          />
        )
      case 'Approved':
        return (
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
            label="Đã duyệt gia hạn"
            size="small"
            sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11 }}
          />
        )
      case 'Rejected':
        return (
          <Chip
            icon={<CancelIcon sx={{ fontSize: '14px !important' }} />}
            label="Từ chối gia hạn"
            size="small"
            sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: 11 }}
          />
        )
      default:
        return <Chip label={status || '—'} size="small" />
    }
  }

  // Mở modal xin gia hạn
  const handleOpenExtModal = (borrow) => {
    setSelectedBorrow(borrow)
    setRequestedDays(7)
    setExtReason('')
    setExtDialogOpen(true)
  }

  // Gửi xin gia hạn (POST /api/borrow-requests/{id}/extensions)
  const handleSubmitExtension = async () => {
    if (!selectedBorrow) return
    if (!extReason.trim()) {
      setToast({ open: true, message: 'Vui lòng nhập lý do xin gia hạn', severity: 'warning' })
      return
    }

    const newDueDate = addDaysToIso(selectedBorrow.dueDate, requestedDays)
    if (!newDueDate) {
      setToast({ open: true, message: 'Không xác định được hạn trả mới hợp lệ', severity: 'error' })
      return
    }

    setExtSubmitting(true)
    try {
      await borrowService.requestExtension(selectedBorrow.borrowRequestId, {
        newDueDate,
        reason: extReason.trim(),
      })
      setToast({ open: true, message: 'Đã gửi yêu cầu gia hạn đến giảng viên thành công!', severity: 'success' })
      setExtDialogOpen(false)
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Xin gia hạn thất bại', severity: 'error' })
    } finally {
      setExtSubmitting(false)
    }
  }

  // Giảng viên duyệt gia hạn (POST /api/borrow-extensions/{extensionId}/approve)
  const handleApproveExtension = async (ext) => {
    try {
      await borrowService.approveExtension(ext.extensionId, { comment: 'Đã chấp thuận gia hạn đồ án' })
      setToast({ open: true, message: `Đã duyệt gia hạn cho đơn ${ext.requestCode}!`, severity: 'success' })
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Duyệt gia hạn thất bại', severity: 'error' })
    }
  }

  // Sinh viên rút lại đơn mượn bổ sung đang chờ giảng viên duyệt
  const handleWithdrawSupplementary = async (req) => {
    if (!req?.projectId) return
    try {
      await borrowService.withdrawSupplementaryBorrow(req.projectId)
      setToast({ open: true, message: `Đã rút lại đơn mượn bổ sung ${req.requestCode || ''}.`, severity: 'success' })
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Không thể rút lại đơn mượn bổ sung.', severity: 'error' })
    }
  }

  // Giảng viên mở modal từ chối gia hạn (POST /api/borrow-extensions/{extensionId}/reject)
  const handleOpenRejectExt = (ext) => {
    setSelectedExt(ext)
    setRejectReason('')
    setRejectExtDialogOpen(true)
  }

  // Gửi từ chối gia hạn
  const handleConfirmRejectExt = async () => {
    if (!selectedExt) return
    if (!rejectReason.trim()) {
      setToast({ open: true, message: 'Vui lòng nhập lý do từ chối', severity: 'warning' })
      return
    }

    setRejectSubmitting(true)
    try {
      await borrowService.rejectExtension(selectedExt.extensionId, { reason: rejectReason.trim() })
      setToast({ open: true, message: `Đã từ chối gia hạn đơn ${selectedExt.requestCode}`, severity: 'info' })
      setRejectExtDialogOpen(false)
      await refreshData()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Từ chối thất bại', severity: 'error' })
    } finally {
      setRejectSubmitting(false)
    }
  }

  return (
    <PortalLayout
      headerTitle={isLecturer ? 'Duyệt yêu cầu mượn' : 'Mượn / Trả linh kiện'}
      headerSubtitle={
        isLecturer
          ? 'Duyệt đề tài, mượn bổ sung và xin gia hạn của sinh viên'
          : 'Theo dõi đơn mượn, mượn bổ sung và xin gia hạn'
      }
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto', py: 3 }}>
        {/* Header Bar */}
        <Box sx={{ mb: isLecturer ? 0 : 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
          {!isLecturer && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/borrow/supplementary/create')}
                sx={{
                  bgcolor: '#0058be',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 1.5,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#0049a3' },
                }}
              >
                Tạo phiếu mượn bổ sung
              </Button>
            </Box>
          )}
        </Box>

        {isLecturer && (
          <Paper
            elevation={0}
            sx={{ p: 3, mb: 4, borderRadius: 2, border: '1px solid #e4e6ef', bgcolor: '#ffffff' }}
          >
            {/* Tiêu đề & Tổng số */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, gap: 1, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 18 }}>
                  Quản lý đơn duyệt đồ án & mượn linh kiện
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: 13 }}>
                  Theo dõi tất cả đề tài đồ án của sinh viên, xem thông tin chi tiết và duyệt mượn linh kiện
                </Typography>
              </Box>
              <Chip
                label={`${lecturerProjects.length} đề tài`}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: '#0058be', fontWeight: 800, fontSize: 12 }}
              />
            </Box>

            {/* Thanh lọc trạng thái và ô tìm kiếm */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant={projectStatusFilter === 'all' ? 'contained' : 'outlined'}
                  onClick={() => setProjectStatusFilter('all')}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.8,
                    py: 0.6,
                    bgcolor: projectStatusFilter === 'all' ? '#0058be' : 'transparent',
                    borderColor: projectStatusFilter === 'all' ? '#0058be' : '#e2e8f0',
                    color: projectStatusFilter === 'all' ? '#fff' : '#475569',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: projectStatusFilter === 'all' ? '#004ca6' : '#f8fafc',
                    },
                  }}
                >
                  Tất cả ({lecturerProjects.length})
                </Button>
                <Button
                  size="small"
                  variant={projectStatusFilter === 'Submitted' ? 'contained' : 'outlined'}
                  onClick={() => setProjectStatusFilter('Submitted')}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.8,
                    py: 0.6,
                    bgcolor: projectStatusFilter === 'Submitted' ? '#b45309' : '#fffbeb',
                    borderColor: projectStatusFilter === 'Submitted' ? '#b45309' : '#fde68a',
                    color: projectStatusFilter === 'Submitted' ? '#fff' : '#b45309',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: projectStatusFilter === 'Submitted' ? '#92400e' : '#fef3c7',
                    },
                  }}
                >
                  Chờ duyệt ({pendingCount})
                </Button>
                <Button
                  size="small"
                  variant={projectStatusFilter === 'Approved' ? 'contained' : 'outlined'}
                  onClick={() => setProjectStatusFilter('Approved')}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.8,
                    py: 0.6,
                    bgcolor: projectStatusFilter === 'Approved' ? '#15803d' : '#f0fdf4',
                    borderColor: projectStatusFilter === 'Approved' ? '#15803d' : '#bbf7d0',
                    color: projectStatusFilter === 'Approved' ? '#fff' : '#15803d',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: projectStatusFilter === 'Approved' ? '#166534' : '#dcfce7',
                    },
                  }}
                >
                  Đã duyệt ({approvedCount})
                </Button>
                <Button
                  size="small"
                  variant={projectStatusFilter === 'Rejected' ? 'contained' : 'outlined'}
                  onClick={() => setProjectStatusFilter('Rejected')}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.8,
                    py: 0.6,
                    bgcolor: projectStatusFilter === 'Rejected' ? '#dc2626' : '#fef2f2',
                    borderColor: projectStatusFilter === 'Rejected' ? '#dc2626' : '#fecaca',
                    color: projectStatusFilter === 'Rejected' ? '#fff' : '#dc2626',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: projectStatusFilter === 'Rejected' ? '#b91c1c' : '#fee2e2',
                    },
                  }}
                >
                  Bị từ chối ({rejectedCount})
                </Button>
              </Box>

              <TextField
                placeholder="Tìm kiếm theo đề tài, nhóm, mã SV..."
                size="small"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#94a3b8', fontSize: 19 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  width: { xs: '100%', sm: 300 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    fontSize: 12,
                    bgcolor: '#f8fafc',
                  },
                }}
              />
            </Box>

            {lecturerProjectsError && <Alert severity="error" sx={{ mb: 2 }}>{lecturerProjectsError}</Alert>}

            {loadingLecturerProjects ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fafbff' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>ĐỀ TÀI / DỰ ÁN</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NHÓM / LỚP</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NGÀY GỬI</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NGÀY MƯỢN / TRẢ</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>THAO TÁC</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLecturerProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          {projectSearch
                            ? 'Không tìm thấy đề tài nào phù hợp với từ khóa.'
                            : 'Không có đề tài nào trong danh mục này.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLecturerProjects.map((project) => {
                        const isSupplementaryPending =
                          Boolean(project.isSupplementary) ||
                          (Boolean(project.hasPendingApproval) && project.status === 'Approved')
                        const isPending =
                          ['Submitted', 'PendingApproval', 'PendingLecturer', 'Pending'].includes(project.status) ||
                          isSupplementaryPending ||
                          Boolean(project.hasPendingApproval)
                        return (
                          <TableRow key={project.projectId} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e' }}>
                                {project.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                {[project.pendingRequestCode || project.requestCode, project.ownerName].filter(Boolean).join(' · ') || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#334155' }}>
                              <strong>{project.teamName || 'Nhóm'}</strong> · {project.classCode || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#64748b' }}>
                              {formatVietnamDate(project.submittedAt)}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#334155' }}>
                              {formatVietnamDate(project.borrowDate)}
                              {' / '}
                              {formatVietnamDate(project.dueDate)}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                                {getProjectStatusChip(project.status)}
                                {isSupplementaryPending && (
                                  <Chip
                                    label="Mượn thêm · Chờ duyệt"
                                    size="small"
                                    sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 10.5 }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              {isPending ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => setSelectedProject(project)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: 11,
                                    borderRadius: 1.5,
                                    bgcolor: '#0058be',
                                    boxShadow: 'none',
                                    '&:hover': { bgcolor: '#004ca6' },
                                  }}
                                >
                                  {isSupplementaryPending ? 'Duyệt mượn thêm' : 'Duyệt'}
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => setSelectedProject(project)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: 11,
                                    borderRadius: 1.5,
                                    borderColor: '#cbd5e1',
                                    color: '#334155',
                                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                                  }}
                                >
                                  Chi tiết
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
            )}
          </Paper>
        )}

        {/* ===================== BẢNG 1: QUẢN LÝ ĐƠN MƯỢN LINH KIỆN CỦA TÔI ===================== */}
        {!isLecturer && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 4,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                  Quản lý đơn mượn linh kiện của tôi
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Theo dõi tiến trình đơn mượn, đơn quá hạn, xin gia hạn và xem lại lịch sử các đơn trước đây
                </Typography>
              </Box>
              <Chip
                label={`${studentBorrowCounts.all} đơn`}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: '#0058be', fontWeight: 800, fontSize: 11 }}
              />
            </Box>

            {/* Thanh lọc trạng thái (Tất cả / Đang xử lý / Quá hạn / Lịch sử) & Tìm kiếm */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant={borrowStatusFilter === 'all' ? 'contained' : 'outlined'}
                  onClick={() => setBorrowStatusFilter('all')}
                  sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: 12, fontWeight: 700, py: 0.35 }}
                >
                  Tất cả ({studentBorrowCounts.all})
                </Button>
                <Button
                  size="small"
                  variant={borrowStatusFilter === 'active' ? 'contained' : 'outlined'}
                  onClick={() => setBorrowStatusFilter('active')}
                  sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: 12, fontWeight: 700, py: 0.35 }}
                >
                  Đang xử lý ({studentBorrowCounts.active})
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant={borrowStatusFilter === 'overdue' ? 'contained' : 'outlined'}
                  onClick={() => setBorrowStatusFilter('overdue')}
                  sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: 12, fontWeight: 700, py: 0.35 }}
                >
                  Quá hạn ({studentBorrowCounts.overdue})
                </Button>
                <Button
                  size="small"
                  color="success"
                  variant={borrowStatusFilter === 'history' ? 'contained' : 'outlined'}
                  onClick={() => setBorrowStatusFilter('history')}
                  sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: 12, fontWeight: 700, py: 0.35 }}
                >
                  Lịch sử ({studentBorrowCounts.history})
                </Button>
              </Box>

              <TextField
                placeholder="Tìm mã đơn, đề tài, lớp, phòng lab..."
                size="small"
                value={borrowSearch}
                onChange={(e) => setBorrowSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  width: { xs: '100%', sm: 290 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                    fontSize: 12,
                    bgcolor: '#f8fafc',
                  },
                }}
              />
            </Box>

            {studentDataError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={refreshData} sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Thử lại
                  </Button>
                }
              >
                {studentDataError}
              </Alert>
            )}

            {loadingStudentData ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={30} />
              </Box>
            ) : (
              <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#fafbff' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ ĐƠN</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐỀ TÀI / DỰ ÁN</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>LỚP MÔN HỌC</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN TRẢ</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredBorrowRequests.map((b) => {
                      const overdue = isRequestOverdue(b)
                      const meta = getBorrowRequestStatusMeta(overdue ? 'Overdue' : b.status)
                      return (
                        <TableRow key={b.borrowRequestId} hover>
                          <TableCell sx={{ fontWeight: 800, fontSize: 13, color: '#0058be', whiteSpace: 'nowrap' }}>
                            {b.requestCode || '—'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12.5, color: '#131b2e' }}>
                              {b.projectTitle || '—'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11 }}>
                              {b.roomName || b.roomCode || 'Phòng Lab'}
                              {typeof b.itemCount === 'number' && b.itemCount > 0 ? ` · ${b.itemCount} món` : ''}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: '#424754' }}>
                            <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                              {b.classCode || '—'}
                            </Typography>
                            {b.teamName && (
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11 }}>
                                {b.teamName}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: overdue ? '#dc2626' : '#131b2e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {b.dueDate ? formatVietnamDate(b.dueDate) : '—'}
                          </TableCell>
                          <TableCell>
                            <Chip label={meta.label} size="small" sx={meta.sx} />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {/* Nút Xin gia hạn (chỉ cho đơn đang mượn và chưa quá hạn) */}
                              {b.status === 'Borrowing' && !overdue && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<UpdateIcon sx={{ fontSize: 13 }} />}
                                  onClick={() => handleOpenExtModal(b)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: 11,
                                    borderRadius: 1,
                                    borderColor: '#b45309',
                                    color: '#b45309',
                                    bgcolor: '#fffbeb',
                                    '&:hover': { bgcolor: '#fef3c7' },
                                  }}
                                >
                                  Xin gia hạn
                                </Button>
                              )}

                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(`/borrow/requests/${b.borrowRequestId}`)}
                                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, borderRadius: 1 }}
                              >
                                Chi tiết
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredBorrowRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3.5, color: 'text.secondary' }}>
                          {borrowSearch.trim()
                            ? 'Không tìm thấy đơn mượn nào phù hợp với từ khóa.'
                            : borrowStatusFilter === 'history'
                              ? 'Bạn chưa có đơn mượn nào trong lịch sử (Đã trả / Đã hủy / Từ chối).'
                              : borrowStatusFilter === 'overdue'
                                ? 'Không có đơn mượn nào đang quá hạn.'
                                : borrowStatusFilter === 'active'
                                  ? 'Không có đơn mượn nào đang xử lý.'
                                  : 'Chưa có đơn mượn nào.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {/* ===================== BẢNG 2: DANH SÁCH YÊU CẦU GIA HẠN ===================== */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 2,
            border: '1px solid #e4e6ef',
            bgcolor: '#ffffff',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                Yêu cầu gia hạn đơn mượn
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Sinh viên xin gia hạn thời gian mượn trước khi quá hạn, giảng viên duyệt hoặc từ chối
              </Typography>
            </Box>
            <Chip
              label={`${extensions.length} yêu cầu`}
              size="small"
              sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
            />
          </Box>

          <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#fafbff' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ ĐƠN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NGƯỜI XIN / DỰ ÁN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN CŨ</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN MỚI XIN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>LÝ DO GIA HẠN</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {extensions.map((ext) => {
                  const oldDate = ext.oldDueDate || ext.currentDueDate
                  const extraDays = getExtensionDays(oldDate, ext.newDueDate, ext.requestedDays)
                  return (
                    <TableRow key={ext.extensionId} hover>
                      <TableCell sx={{ fontWeight: 800, fontSize: 13, color: '#0058be', whiteSpace: 'nowrap' }}>
                        {ext.requestCode || '—'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12, color: '#131b2e' }}>
                          {ext.requesterName || ext.studentName || '—'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                          {ext.projectTitle || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                        {oldDate ? formatVietnamDate(oldDate) : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#15803d', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {extraDays ? `+${extraDays} ngày ` : ''}
                        {ext.newDueDate ? `(${formatVietnamDate(ext.newDueDate)})` : '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: '#424754', maxWidth: 280 }}>
                        {ext.reason || '—'}
                      </TableCell>
                      <TableCell>
                        {getExtensionStatusChip(ext.status)}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {isLecturer && ext.status === 'Pending' ? (
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              onClick={() => handleApproveExtension(ext)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 11,
                                borderRadius: 1,
                                boxShadow: 'none',
                              }}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleOpenRejectExt(ext)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 11,
                                borderRadius: 1,
                              }}
                            >
                              Từ chối
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {ext.status === 'Approved' ? 'Đã duyệt' : ext.status === 'Rejected' ? 'Đã từ chối' : 'Chờ giảng viên'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {extensions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      Chưa có yêu cầu gia hạn nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* ===================== BẢNG 3: PHIẾU MƯỢN BỔ SUNG (MF5.1) ===================== */}
        {!isLecturer && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: '1px solid #e4e6ef',
              bgcolor: '#ffffff',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                  Phiếu mượn bổ sung
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Danh sách các phiếu mượn thêm linh kiện phát sinh cho đề tài đã duyệt
                </Typography>
              </Box>
              <Chip
                label={`${supplementaryRequests.length} phiếu`}
                size="small"
                sx={{ bgcolor: '#eaedff', color: '#0058be', fontWeight: 800, fontSize: 11 }}
              />
            </Box>

            <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fafbff' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>MÃ PHIẾU</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐƠN GỐC</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>ĐỀ TÀI / LỚP</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>PHÒNG LAB / SỐ MÓN</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN TRẢ</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>THAO TÁC</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplementaryRequests.map((req) => {
                    const meta = getBorrowRequestStatusMeta(isRequestOverdue(req) ? 'Overdue' : req.status)
                    return (
                      <TableRow key={req.borrowRequestId || req.requestCode} hover>
                        <TableCell sx={{ fontWeight: 800, fontSize: 13, color: '#0058be', whiteSpace: 'nowrap' }}>
                          {req.requestCode || '—'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#424754', whiteSpace: 'nowrap' }}>
                          {req.originalBorrowCode || '—'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12, color: '#131b2e' }}>
                            {req.projectTitle || '—'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                            {req.classCode || '—'}{req.teamName ? ` · ${req.teamName}` : ''}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#424754' }}>
                          {req.roomName || req.roomCode || '—'}
                          {typeof req.itemCount === 'number' && req.itemCount > 0 ? ` · ${req.itemCount} món` : ''}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: '#131b2e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {req.dueDate ? formatVietnamDate(req.dueDate) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip label={meta.label} size="small" sx={meta.sx} />
                        </TableCell>
                        <TableCell sx={{ textAlign: 'right' }}>
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {req.status === 'Pending' && req.projectId && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => handleWithdrawSupplementary(req)}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: 11,
                                  borderRadius: 1,
                                }}
                              >
                                Rút lại
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => navigate(`/borrow/requests/${req.borrowRequestId}`)}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: 11,
                                borderRadius: 1,
                                borderColor: '#dcdfe6',
                              }}
                            >
                              Chi tiết
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {supplementaryRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Chưa có phiếu mượn bổ sung nào.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* ===================== MODAL XIN GIA HẠN ĐƠN MƯỢN ===================== */}
        <Dialog open={extDialogOpen} onClose={() => setExtDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
            Xin gia hạn đơn mượn: {selectedBorrow?.requestCode}
          </DialogTitle>
          <DialogContent dividers>
            <DialogContentText sx={{ mb: 2, fontSize: 13 }}>
              Gửi yêu cầu gia hạn thời gian mượn linh kiện đến Giảng viên phụ trách lớp. Yêu cầu chỉ được chấp nhận trước khi đơn bị quá hạn.
            </DialogContentText>

            <TextField
              label="Hạn trả hiện tại"
              value={selectedBorrow?.dueDate ? formatVietnamDate(selectedBorrow.dueDate) : '—'}
              fullWidth
              disabled
              size="small"
              sx={{ mb: 2 }}
            />

            <TextField
              label="Số ngày muốn gia hạn thêm (Tối đa 14 ngày)"
              type="number"
              value={requestedDays}
              onChange={(e) => setRequestedDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
              fullWidth
              size="small"
              helperText={
                selectedBorrow?.dueDate
                  ? `Hạn trả mới dự kiến: ${formatVietnamDate(addDaysToIso(selectedBorrow.dueDate, requestedDays))}`
                  : ''
              }
              slotProps={{ htmlInput: { min: 1, max: 14 } }}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Lý do xin gia hạn (bắt buộc)"
              value={extReason}
              onChange={(e) => setExtReason(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Ví dụ: Nhóm cần thêm 1 tuần để hoàn thiện mạch đo cảm biến..."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setExtDialogOpen(false)} disabled={extSubmitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitExtension}
              disabled={extSubmitting}
              sx={{ bgcolor: '#0058be', textTransform: 'none', fontWeight: 700 }}
            >
              {extSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu gia hạn'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ===================== MODAL TỪ CHỐI GIA HẠN ===================== */}
        <Dialog open={rejectExtDialogOpen} onClose={() => setRejectExtDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
            Từ chối gia hạn đơn {selectedExt?.requestCode}
          </DialogTitle>
          <DialogContent dividers>
            <DialogContentText sx={{ mb: 2, fontSize: 13 }}>
              Vui lòng nhập lý do từ chối gia hạn. Lý do này sẽ được gửi email thông báo cho sinh viên.
            </DialogContentText>

            <TextField
              label="Lý do từ chối (bắt buộc)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Nhập lý do từ chối cụ thể..."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setRejectExtDialogOpen(false)} disabled={rejectSubmitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmRejectExt}
              disabled={rejectSubmitting}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {rejectSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
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
        <ProjectApprovalDialog
          key={selectedProject?.projectId || 'closed'}
          project={selectedProject}
          open={Boolean(selectedProject)}
          onClose={() => setSelectedProject(null)}
          onReviewed={(message) => {
            setSelectedProject(null)
            setToast({ open: true, message, severity: 'success' })
            refreshData()
          }}
        />
      </Container>
    </PortalLayout>
  )
}
