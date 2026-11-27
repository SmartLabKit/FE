import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Tab,
  Tabs,
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
  Search as SearchIcon,
} from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import ProjectApprovalDialog from './ProjectApprovalDialog'
import ProjectStatusChip from '../../components/borrowing/ProjectStatusChip'
import { borrowService } from '../../services/borrowService'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import { projectService } from '../../services/projectService'
import { useAuth } from '../../context/AuthContext'
import { formatVietnamDate } from '../../utils/dateFormatting'
import { borrowProgressOf, currentRequestOfProject, getBorrowRequestStatusMeta } from './borrowHelpers'
import LecturerBorrowTracking from './LecturerBorrowTracking'
import { labCode, labLabel, labName } from '../../utils/labLabel'

const ACTIVE_BORROW_STATUSES = ['Pending', 'PendingApproval', 'PendingLecturer', 'Submitted', 'Approved', 'Ready', 'Borrowing']
const HISTORY_BORROW_STATUSES = ['Returned', 'Cancelled', 'Rejected']

function isRequestOverdue(borrow) {
  if (!borrow) return false
  if (borrow.status === 'Overdue') return true
  return Boolean(borrow.isOverdue) && !HISTORY_BORROW_STATUSES.includes(borrow.status)
}

/**
 * SupplementaryBorrowList Component
 * Danh sách Đơn mượn & Mượn bổ sung (MF5.1). Không có gia hạn: linh kiện được mượn theo học kỳ của lớp.
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
  const [lecturerProjects, setLecturerProjects] = useState([])
  const [classRequests, setClassRequests] = useState([])
  const [lecturerTab, setLecturerTab] = useState('projects')
  const [classFilter, setClassFilter] = useState('')
  const [loadingLecturerProjects, setLoadingLecturerProjects] = useState(false)
  const [lecturerProjectsError, setLecturerProjectsError] = useState('')
  const [projectStatusFilter, setProjectStatusFilter] = useState('all') // 'all' | 'Submitted' | 'Approved' | 'Rejected'
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  // Bấm thông báo "Project chờ duyệt": ?project=<projectId> mở luôn hộp thoại duyệt của đề tài đó
  const [searchParams, setSearchParams] = useSearchParams()
  const projectToOpen = searchParams.get('project')
  const requestToOpen = searchParams.get('request')
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Hàm tải toàn bộ dữ liệu theo vai trò (Sinh viên vs Giảng viên)
  useEffect(() => {
    if ((!projectToOpen && !requestToOpen) || lecturerProjects.length === 0) return
    const target = lecturerProjects.find((project) =>
      projectToOpen
        ? project.projectId === projectToOpen
        : project.pendingBorrowRequestId === requestToOpen
          || (project.borrowRequests || []).some((request) => request.borrowRequestId === requestToOpen))
    const timer = window.setTimeout(() => {
      if (target) setSelectedProject(target)
      setSearchParams((params) => {
        params.delete('project')
        params.delete('request')
        return params
      }, { replace: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [projectToOpen, requestToOpen, lecturerProjects, setSearchParams])

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (isLecturer) {
      if (!silent) setLoadingLecturerProjects(true)
      try {
        const [projects, requests] = await Promise.all([
          projectService.getLecturerProjects(),
          borrowService.getTeachingBorrowRequests().catch(() => []),
        ])
        setLecturerProjects(Array.isArray(projects) ? projects : [])
        setClassRequests(Array.isArray(requests) ? requests : [])
        setLecturerProjectsError('')
      } catch (err) {
        setLecturerProjectsError(err.message || 'Không thể tải danh sách project của sinh viên.')
      } finally {
        setLoadingLecturerProjects(false)
      }
      return
    }

    if (!silent) setLoadingStudentData(true)
    setStudentDataError('')
    try {
      const overview = await borrowService.getStudentBorrowOverview({ includeExtensions: false })
      setBorrowRequests(overview.borrowRequests || [])
      setSupplementaryRequests(overview.supplementaryRequests || [])
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

  // BE báo dữ liệu đổi (đề tài mới, đơn đổi trạng thái...) thì tải lại, không hiện vòng xoay
  const refreshSilently = useCallback(() => {
    loadData({ silent: true })
  }, [loadData])
  useEntityChanged(refreshSilently)

  // Lọc theo lớp, dùng chung cho tab Đề tài và tab Theo dõi mượn
  const classOptions = useMemo(() => {
    const codes = new Set()
    lecturerProjects.forEach((project) => project.classCode && codes.add(project.classCode))
    classRequests.forEach((request) => request.classCode && codes.add(request.classCode))
    return [...codes].sort()
  }, [lecturerProjects, classRequests])
  const classProjects = useMemo(
    () => lecturerProjects.filter((project) => !classFilter || project.classCode === classFilter),
    [lecturerProjects, classFilter]
  )
  const classScopedRequests = useMemo(
    () => classRequests.filter((request) => !classFilter || request.classCode === classFilter),
    [classRequests, classFilter]
  )

  // Số đơn quá hạn của các lớp giảng viên dạy, hiện trên tab Theo dõi mượn
  const overdueClassRequests = useMemo(
    () => classScopedRequests.filter((request) => borrowProgressOf(request)?.key === 'overdue').length,
    [classScopedRequests]
  )

  // Thống kê số lượng project theo trạng thái cho Giảng viên (bao gồm cả đề tài đã Approved nhưng có đơn mượn thêm Pending)
  const pendingCount = useMemo(
    () =>
      classProjects.filter(
        (p) =>
          ['Submitted', 'PendingApproval', 'PendingLecturer', 'Pending'].includes(p.status) ||
          Boolean(p.hasPendingApproval) ||
          Boolean(p.isSupplementary)
      ).length,
    [classProjects]
  )

  const approvedCount = useMemo(
    () => classProjects.filter((p) => p.status === 'Approved').length,
    [classProjects]
  )

  const rejectedCount = useMemo(
    () => classProjects.filter((p) => p.status === 'Rejected').length,
    [classProjects]
  )

  // Danh sách project đã lọc
  const filteredLecturerProjects = useMemo(() => {
    return classProjects.filter((project) => {
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
        const matchTeam = project.teamName?.toLowerCase().includes(q)
        const matchClass = project.classCode?.toLowerCase().includes(q)
        if (!matchTitle && !matchTeam && !matchClass) {
          return false
        }
      }

      return true
    })
  }, [classProjects, projectStatusFilter, projectSearch])

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
        const matchRoom = labLabel(b, '').toLowerCase().includes(q)
        if (!matchCode && !matchTitle && !matchClass && !matchRoom) return false
      }

      return true
    })
  }, [borrowRequests, borrowStatusFilter, borrowSearch])

  const getProjectStatusChip = (status) => <ProjectStatusChip status={status} />

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

  return (
    <PortalLayout
      headerTitle={isLecturer ? 'Duyệt đề tài' : 'Mượn / Trả linh kiện'}
      headerSubtitle={
        isLecturer
          ? 'Duyệt đề tài và mượn bổ sung của sinh viên'
          : 'Theo dõi đơn mượn và mượn bổ sung'
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
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 1, mb: 2.5, borderBottom: '1px solid #eef0f6' }}>
              <Tabs
                value={lecturerTab}
                onChange={(_, value) => setLecturerTab(value)}
                sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: 14 } }}
              >
                <Tab value="projects" label="Đề tài" />
                <Tab value="borrows" label={overdueClassRequests > 0 ? `Theo dõi mượn (${overdueClassRequests} quá hạn)` : 'Theo dõi mượn'} />
              </Tabs>
              <TextField
                select
                size="small"
                label="Lớp"
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                sx={{ minWidth: 180, my: 0.75, '& .MuiInputBase-root': { height: 34, fontSize: 13 } }}
              >
                <MenuItem value="">Tất cả lớp</MenuItem>
                {classOptions.map((code) => (
                  <MenuItem key={code} value={code}>{code}</MenuItem>
                ))}
              </TextField>
            </Box>

            {lecturerTab === 'borrows' && <LecturerBorrowTracking requests={classScopedRequests} />}

            {lecturerTab === 'projects' && (
            <>

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
                  Tất cả ({classProjects.length})
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
                  Chờ GV duyệt ({pendingCount})
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
                placeholder="Tìm theo đề tài, nhóm, lớp..."
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
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NHÓM</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>LỚP</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>NGÀY GỬI</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>HẠN TRẢ</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>TRẠNG THÁI</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>MƯỢN ĐỒ</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>THAO TÁC</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredLecturerProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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
                        const pendingRequests = Array.isArray(project.pendingRequests) ? project.pendingRequests : []
                        let borrowProgress = null
                        if (project.status === 'Approved') {
                          borrowProgress = borrowProgressOf(currentRequestOfProject(classRequests, project.projectId))
                        }
                        return (
                          <TableRow key={project.projectId} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e' }}>
                                {project.title}
                              </Typography>
                              {pendingRequests.length > 1 && (
                                <Typography variant="caption" sx={{ display: 'block', color: '#b45309', fontWeight: 700, mt: 0.25 }}>
                                  Tách {pendingRequests.length} đơn theo lab: {pendingRequests.map((r) => r.roomCode).join(' · ')}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                              {project.teamName || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#334155' }}>
                              {project.classCode || '—'}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#64748b' }}>
                              {formatVietnamDate(project.submittedAt)}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#334155' }}>
                              {formatVietnamDate(project.dueDate)}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                                {getProjectStatusChip(project.status)}
                                {isSupplementaryPending && (
                                  <Chip
                                    label="Mượn thêm · Chờ GV duyệt"
                                    size="small"
                                    sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11 }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {borrowProgress ? (
                                <Chip
                                  size="small"
                                  label={borrowProgress.label}
                                  sx={{ ...borrowProgress.sx, cursor: 'pointer' }}
                                  onClick={() => setLecturerTab('borrows')}
                                />
                              ) : (
                                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: 12 }}>—</Typography>
                              )}
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
            </>
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
                  Theo dõi tiến trình đơn mượn, đơn quá hạn và xem lại lịch sử các đơn trước đây
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
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13, color: '#131b2e' }}>
                              {b.projectTitle || '—'}
                            </Typography>
                            <Typography variant="caption" title={labName(b)} sx={{ color: '#64748b', fontSize: 11 }}>
                              {labCode(b, 'Phòng Lab')}
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

        {/* ===================== BẢNG 2: PHIẾU MƯỢN BỔ SUNG (MF5.1) ===================== */}
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
                        <TableCell title={labName(req)} sx={{ fontSize: 12, color: '#424754' }}>
                          {labCode(req)}
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
          key={selectedProject?.pendingBorrowRequestId || selectedProject?.projectId || 'closed'}
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
