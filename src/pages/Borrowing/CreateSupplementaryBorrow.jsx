import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
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
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  CalendarToday as CalendarIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Memory as MemoryIcon,
  Remove as RemoveIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Undo as UndoIcon,
} from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { borrowService } from '../../services/borrowService'
import { projectService } from '../../services/projectService'
import { useAuth } from '../../context/AuthContext'
import { formatVietnamDate } from '../../utils/dateFormatting'

const REASON_MAX_LENGTH = 250
const NOTE_MAX_LENGTH = 255
const MAX_COMPONENTS = 100

function getBorrowableQty(comp) {
  if (typeof comp?.borrowableQuantity === 'number') return comp.borrowableQuantity
  if (typeof comp?.availableQuantity === 'number') return comp.availableQuantity
  return 0
}

/**
 * CreateSupplementaryBorrow Component (MF5.1 - Mượn thêm linh kiện)
 * Tuân thủ đúng luồng 4.6 & DTO SupplementaryBorrowRequest / BorrowDeadlineResponse:
 * - Chọn đề tài đã Approved của nhóm (hoặc nhận qua ?projectId=...)
 * - Tự động lấy hạn trả theo học kỳ từ GET /api/projects/{id}/borrow-deadline (chỉ đọc)
 * - Cho phép chọn linh kiện từ kho (borrowableQuantity > 0), nhập số lượng, ghi chú và lý do (<= 250 ký tự)
 * - Gửi POST /api/projects/{id}/supplementary-borrow với { reason, components: [{ componentId, quantity, note }] }
 */
export default function CreateSupplementaryBorrow() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialProjectId = searchParams.get('projectId') || ''
  const { user } = useAuth()

  const currentUser = user || {
    fullName: 'Sinh viên',
    name: 'Sinh viên',
    studentCode: '',
  }

  // Danh sách đề tài đã duyệt (Approved) của sinh viên
  const [approvedProjects, setApprovedProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId)

  // Hạn trả theo học kỳ từ GET /api/projects/{id}/borrow-deadline
  const [deadline, setDeadline] = useState(null)
  const [loadingDeadline, setLoadingDeadline] = useState(false)
  const [deadlineError, setDeadlineError] = useState('')

  // Danh mục linh kiện kho từ GET /api/components?isActive=true
  const [availableComponents, setAvailableComponents] = useState([])
  const [loadingComponents, setLoadingComponents] = useState(false)
  const [searchComponent, setSearchComponent] = useState('')

  // Nội dung form mượn thêm (luôn khởi tạo trống, chỉnh sửa hoàn toàn tự do)
  const [selectedItems, setSelectedItems] = useState([])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  const loadApprovedProjects = useCallback(async () => {
    setLoadingProjects(true)
    setProjectsError('')
    try {
      const list = await borrowService.getStudentApprovedProjects()
      setApprovedProjects(list)
      if (list.length > 0) {
        setSelectedProjectId((prev) => {
          if (prev && list.some((p) => p.projectId === prev)) return prev
          if (initialProjectId && list.some((p) => p.projectId === initialProjectId)) return initialProjectId
          return list[0].projectId
        })
      } else {
        setSelectedProjectId('')
      }
    } catch (err) {
      setProjectsError(err.message || 'Không thể tải danh sách đề tài đã duyệt của nhóm.')
    } finally {
      setLoadingProjects(false)
    }
  }, [initialProjectId])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (active) loadApprovedProjects()
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [loadApprovedProjects, user?.userId])

  // Tải hạn trả theo học kỳ mỗi khi đổi đề tài được chọn
  useEffect(() => {
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      if (!selectedProjectId) {
        setDeadline(null)
        setDeadlineError('')
        setLoadingDeadline(false)
        return
      }
      setLoadingDeadline(true)
      setDeadlineError('')
      try {
        const res = await projectService.getBorrowDeadline(selectedProjectId)
        if (active) setDeadline(res)
      } catch (err) {
        if (active) {
          setDeadline(null)
          setDeadlineError(err.message || 'Không thể tải hạn trả theo học kỳ của đề tài.')
        }
      } finally {
        if (active) setLoadingDeadline(false)
      }
    })

    return () => {
      active = false
    }
  }, [selectedProjectId])

  // Tải danh mục linh kiện kho theo từ khóa tìm kiếm (có debounce nhẹ)
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoadingComponents(true)
      borrowService
        .getAvailableComponents(searchComponent)
        .then((items) => {
          if (active) setAvailableComponents(Array.isArray(items) ? items : [])
        })
        .catch(() => {
          if (active) setAvailableComponents([])
        })
        .finally(() => {
          if (active) setLoadingComponents(false)
        })
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchComponent])

  const selectedProject = useMemo(
    () => approvedProjects.find((p) => p.projectId === selectedProjectId) || null,
    [approvedProjects, selectedProjectId]
  )

  // Kiểm tra xem đề tài có đang có đơn mượn bổ sung ở trạng thái Pending không (mỗi lúc chỉ 1 đơn chờ duyệt)
  const pendingSupplementary = useMemo(() => {
    const borrows = Array.isArray(selectedProject?.borrowRequests) ? selectedProject.borrowRequests : []
    return borrows.find((b) => b.status === 'Pending') || null
  }, [selectedProject])

  // Kiểm tra đề tài đã nộp bài cuối hay chưa (Pending / Accepted -> không được mượn thêm)
  const isFinalSubmitted = ['Pending', 'Accepted'].includes(selectedProject?.finalStatus)
  const canSubmitForProject =
    Boolean(selectedProject) &&
    !pendingSupplementary &&
    !isFinalSubmitted &&
    deadline?.canBorrow !== false

  // Chọn / bỏ chọn linh kiện từ danh mục bên trái
  const handleToggleComponent = (comp) => {
    const borrowable = getBorrowableQty(comp)
    const isSelected = selectedItems.some((i) => i.componentId === comp.componentId)
    if (isSelected) {
      setSelectedItems((prev) => prev.filter((i) => i.componentId !== comp.componentId))
      return
    }
    if (borrowable <= 0) {
      setToast({ open: true, message: 'Linh kiện này hiện không còn tồn kho khả dụng để mượn.', severity: 'warning' })
      return
    }
    if (selectedItems.length >= MAX_COMPONENTS) {
      setToast({ open: true, message: `Mỗi đơn chỉ được chọn tối đa ${MAX_COMPONENTS} linh kiện.`, severity: 'warning' })
      return
    }
    setSelectedItems((prev) => [
      ...prev,
      {
        componentId: comp.componentId,
        componentCode: comp.componentCode,
        componentName: comp.componentName,
        unit: comp.unit || 'cái',
        trackingType: comp.trackingType,
        borrowableQuantity: borrowable,
        quantity: 1,
        note: '',
      },
    ])
  }

  const handleQuantityChange = (componentId, nextValue) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.componentId !== componentId) return item
        const maxQty = Math.min(1000, Math.max(1, item.borrowableQuantity || 1))
        const parsed = Number.parseInt(nextValue, 10)
        const clamped = Number.isNaN(parsed) ? 1 : Math.max(1, Math.min(maxQty, parsed))
        return { ...item, quantity: clamped }
      })
    )
  }

  const handleNoteChange = (componentId, nextNote) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.componentId === componentId
          ? { ...item, note: String(nextNote || '').slice(0, NOTE_MAX_LENGTH) }
          : item
      )
    )
  }

  const handleRemoveItem = (componentId) => {
    setSelectedItems((prev) => prev.filter((i) => i.componentId !== componentId))
  }

  const totalCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [selectedItems]
  )

  // Rút lại đơn mượn thêm đang chờ duyệt (POST /api/projects/{id}/supplementary-borrow/withdraw)
  const handleWithdrawPending = async () => {
    if (!selectedProject?.projectId) return
    setWithdrawing(true)
    try {
      await borrowService.withdrawSupplementaryBorrow(selectedProject.projectId)
      setToast({ open: true, message: 'Đã rút lại đơn mượn thêm đang chờ duyệt.', severity: 'success' })
      await loadApprovedProjects()
    } catch (err) {
      setToast({ open: true, message: err.message || 'Không thể rút lại đơn mượn thêm.', severity: 'error' })
    } finally {
      setWithdrawing(false)
    }
  }

  // Gửi yêu cầu mượn thêm (POST /api/projects/{id}/supplementary-borrow)
  const handleSubmit = async () => {
    if (!selectedProject?.projectId) {
      setToast({ open: true, message: 'Vui lòng chọn một đề tài đã được duyệt.', severity: 'warning' })
      return
    }
    if (pendingSupplementary) {
      setToast({ open: true, message: 'Đề tài đang có 1 đơn mượn thêm chờ duyệt. Vui lòng chờ duyệt hoặc rút lại trước.', severity: 'warning' })
      return
    }
    if (isFinalSubmitted) {
      setToast({ open: true, message: 'Đề tài đã nộp bài cuối nên không thể mượn thêm.', severity: 'warning' })
      return
    }
    if (deadline?.canBorrow === false) {
      setToast({ open: true, message: 'Học kỳ đã quá hạn mượn linh kiện.', severity: 'error' })
      return
    }
    if (!reason.trim()) {
      setToast({ open: true, message: 'Vui lòng nhập lý do mượn thêm.', severity: 'warning' })
      return
    }
    if (reason.trim().length > REASON_MAX_LENGTH) {
      setToast({ open: true, message: `Lý do mượn thêm tối đa ${REASON_MAX_LENGTH} ký tự.`, severity: 'warning' })
      return
    }
    if (selectedItems.length === 0) {
      setToast({ open: true, message: 'Cần chọn ít nhất 1 linh kiện để mượn thêm.', severity: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        reason: reason.trim(),
        components: selectedItems.map((item) => ({
          componentId: item.componentId,
          quantity: Number(item.quantity),
          note: item.note?.trim() || null,
        })),
      }

      const updatedProject = await borrowService.createSupplementaryBorrow(selectedProject.projectId, payload)
      setToast({ open: true, message: 'Đã gửi yêu cầu mượn thêm đến giảng viên duyệt!', severity: 'success' })

      const newestBorrowId = updatedProject?.borrowRequests?.[0]?.borrowRequestId
      window.setTimeout(() => {
        if (newestBorrowId) {
          navigate(`/borrow/requests/${newestBorrowId}`)
        } else {
          navigate('/borrow/my-requests')
        }
      }, 700)
    } catch (err) {
      setToast({ open: true, message: err.message || 'Gửi yêu cầu mượn thêm thất bại.', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PortalLayout
      headerTitle="Mượn thêm linh kiện"
      headerSubtitle="Gửi yêu cầu mượn bổ sung linh kiện cho đề tài đã được duyệt"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto', py: 2.5 }}>
        {/* Navigation Breadcrumb */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={() => navigate('/borrow/my-requests')}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: '#0058be',
              fontSize: 13,
              p: 0,
              minWidth: 'auto',
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
            }}
          >
            Đơn mượn của tôi
          </Button>
          <Typography sx={{ color: '#81899a', fontSize: 13 }}>/</Typography>
          <Typography sx={{ color: '#556070', fontSize: 13, fontWeight: 600 }}>
            Mượn thêm linh kiện
          </Typography>
        </Box>

        {/* Page Title */}
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
            Tạo phiếu mượn thêm linh kiện
          </Typography>
          <Typography variant="body2" sx={{ color: '#556070', fontSize: 13 }}>
            Chọn đề tài đã được duyệt, nhập lý do và chọn các linh kiện cần mượn thêm để gửi giảng viên phê duyệt.
          </Typography>
        </Box>

        {projectsError && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {projectsError}
          </Alert>
        )}

        {/* Top Info Bar: Thông tin sinh viên, nhóm, đề tài đã duyệt được chọn */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 2,
            border: '1px solid #e4e6ef',
            bgcolor: '#ffffff',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                NGƯỜI ĐỀ NGHỊ
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                {currentUser.fullName || currentUser.name}
                {currentUser.studentCode ? ` · ${currentUser.studentCode}` : ''}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                NHÓM / LỚP HỌC
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                {selectedProject
                  ? `${selectedProject.teamName || 'Nhóm'} · ${selectedProject.classCode || '—'}`
                  : '—'}
              </Typography>
            </Box>

            {selectedProject?.instructorName && (
              <Box>
                <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                  GIẢNG VIÊN DUYỆT
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                  {selectedProject.instructorName}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ minWidth: { xs: '100%', sm: 320 } }}>
            <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
              ĐỀ TÀI ĐÃ DUYỆT ĐƯỢC CHỌN *
            </Typography>
            {loadingProjects ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Đang tải danh sách đề tài...
                </Typography>
              </Box>
            ) : (
              <Select
                fullWidth
                size="small"
                displayEmpty
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                sx={{
                  borderRadius: 1.5,
                  height: 40,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0058be',
                  bgcolor: '#fafbff',
                }}
              >
                {approvedProjects.length === 0 && (
                  <MenuItem value="" disabled>
                    Chưa có đề tài nào ở trạng thái Đã duyệt (Approved)
                  </MenuItem>
                )}
                {approvedProjects.map((proj) => (
                  <MenuItem key={proj.projectId} value={proj.projectId} sx={{ fontSize: 13, fontWeight: 600 }}>
                    {proj.title} ({proj.classCode || proj.teamName || 'Đề tài'})
                  </MenuItem>
                ))}
              </Select>
            )}
          </Box>
        </Paper>

        {/* Cảnh báo trạng thái đề tài không đủ điều kiện mượn thêm */}
        {!loadingProjects && approvedProjects.length === 0 && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Nhóm của bạn chưa có đề tài nào ở trạng thái <strong>Đã duyệt (Approved)</strong>. Chỉ các đề tài đã được giảng viên duyệt và chưa nộp bài cuối mới có thể gửi phiếu mượn thêm linh kiện.
          </Alert>
        )}

        {pendingSupplementary && (
          <Alert
            severity="warning"
            sx={{ mb: 3, borderRadius: 2 }}
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/borrow/requests/${pendingSupplementary.borrowRequestId}`)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Xem đơn
                </Button>
                <Button
                  size="small"
                  color="warning"
                  variant="contained"
                  startIcon={withdrawing ? <CircularProgress size={14} color="inherit" /> : <UndoIcon fontSize="small" />}
                  disabled={withdrawing}
                  onClick={handleWithdrawPending}
                  sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
                >
                  {withdrawing ? 'Đang rút...' : 'Rút lại đơn chờ duyệt'}
                </Button>
              </Stack>
            }
          >
            Đề tài này đang có đơn mượn thêm <strong>{pendingSupplementary.requestCode}</strong> chờ giảng viên duyệt. Mỗi lúc chỉ được gửi 1 đơn bổ sung chờ duyệt.
          </Alert>
        )}

        {isFinalSubmitted && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Đề tài này đã nộp bài cuối (<strong>{selectedProject.finalStatus}</strong>) nên không thể tạo đơn mượn thêm linh kiện.
          </Alert>
        )}

        {/* 2-Column Layout: Trái (Danh mục linh kiện kho) & Phải (Nội dung phiếu mượn thêm) */}
        <Grid container spacing={3}>
          {/* CỘT TRÁI: DANH MỤC LINH KIỆN */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 15 }}>
                    Danh mục linh kiện trong kho
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#81899a', fontSize: 12 }}>
                    {availableComponents.length} linh kiện đang hoạt động
                  </Typography>
                </Box>
              </Box>

              {/* Tìm kiếm linh kiện */}
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm theo tên, mã linh kiện hoặc hãng..."
                value={searchComponent}
                onChange={(e) => setSearchComponent(e.target.value)}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 40, fontSize: 13 },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#81899a', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {/* Danh sách linh kiện cuộn được */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.25,
                  mb: 2,
                  maxHeight: 540,
                  overflowY: 'auto',
                  pr: 0.5,
                }}
              >
                {loadingComponents ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                    <CircularProgress size={26} />
                  </Box>
                ) : availableComponents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                    Không tìm thấy linh kiện nào phù hợp.
                  </Typography>
                ) : (
                  availableComponents.map((comp) => {
                    const isSelected = selectedItems.some((i) => i.componentId === comp.componentId)
                    const borrowable = getBorrowableQty(comp)
                    const outOfStock = borrowable <= 0
                    return (
                      <Paper
                        key={comp.componentId}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 1.5,
                          border: isSelected ? '1.5px solid #0058be' : '1px solid #e4e6ef',
                          bgcolor: isSelected ? '#fafbff' : '#ffffff',
                          opacity: outOfStock && !isSelected ? 0.65 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1 }}>
                          {comp.primaryImageUrl ? (
                            <Box
                              component="img"
                              src={comp.primaryImageUrl}
                              alt={comp.componentName}
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 1,
                                objectFit: 'cover',
                                border: '1px solid #e2e8f0',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 1,
                                bgcolor: '#f0f4ff',
                                color: '#0058be',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <MemoryIcon sx={{ fontSize: 18 }} />
                            </Box>
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13, lineHeight: 1.3 }}>
                              {comp.componentName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                              {comp.componentCode}
                              {comp.trackingType ? ` · ${comp.trackingType}` : ''}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.25 }}>
                          <Typography variant="caption" sx={{ color: outOfStock ? '#dc2626' : '#424754', fontSize: 12 }}>
                            {outOfStock ? (
                              <strong>Hết tồn khả dụng</strong>
                            ) : (
                              <>
                                Có thể mượn: <strong>{borrowable}</strong> {comp.unit || 'cái'}
                              </>
                            )}
                          </Typography>

                          <Button
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            disabled={outOfStock && !isSelected}
                            onClick={() => handleToggleComponent(comp)}
                            startIcon={isSelected ? <CheckIcon sx={{ fontSize: 14 }} /> : <AddIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              height: 28,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'none',
                              borderRadius: 1,
                              boxShadow: 'none',
                              bgcolor: isSelected ? '#0058be' : 'transparent',
                              color: isSelected ? '#ffffff' : '#334155',
                              borderColor: isSelected ? '#0058be' : '#cbd5e1',
                              '&:hover': {
                                bgcolor: isSelected ? '#0049a3' : '#f1f5f9',
                              },
                            }}
                          >
                            {isSelected ? 'Đã chọn' : 'Chọn'}
                          </Button>
                        </Box>
                      </Paper>
                    )
                  })
                )}
              </Box>

              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11, fontStyle: 'italic', mt: 'auto' }}>
                Số lượng có thể mượn = tồn khả dụng trừ đi phần đã giữ chỗ cho các đơn đã duyệt.
              </Typography>
            </Paper>
          </Grid>

          {/* CỘT PHẢI: NỘI DUNG PHIẾU MƯỢN THÊM */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                      Nội dung phiếu mượn thêm
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: 12 }}>
                      {selectedProject
                        ? `Đề tài: ${selectedProject.title}`
                        : 'Chọn một đề tài đã duyệt ở trên để bắt đầu'}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${selectedItems.length} linh kiện`}
                    size="small"
                    sx={{
                      height: 24,
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: '#eff6ff',
                      color: '#0058be',
                      borderRadius: 1,
                    }}
                  />
                </Box>

                {/* 1. LÝ DO MƯỢN THÊM (bắt buộc, tối đa 250 ký tự) */}
                <Box sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', fontSize: 12 }}>
                      LÝ DO MƯỢN THÊM *
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: reason.length >= REASON_MAX_LENGTH ? '#dc2626' : '#64748b',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {reason.length}/{REASON_MAX_LENGTH}
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX_LENGTH))}
                    placeholder="Vì sao nhóm cần mượn thêm linh kiện? Giảng viên sẽ đọc lý do này trước khi duyệt..."
                    slotProps={{ htmlInput: { maxLength: REASON_MAX_LENGTH } }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                  />
                </Box>

                {/* 2. HẠN TRẢ THEO HỌC KỲ (CHỈ ĐỌC - GET /api/projects/{id}/borrow-deadline) */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.75, display: 'block', fontSize: 12 }}>
                    HẠN TRẢ (THEO HỌC KỲ CỦA LỚP)
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.75,
                      borderRadius: 1.5,
                      border: '1px solid #e2e8f0',
                      bgcolor: '#f8fafc',
                    }}
                  >
                    {loadingDeadline ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Đang tải hạn trả theo học kỳ...
                        </Typography>
                      </Box>
                    ) : deadlineError ? (
                      <Typography variant="caption" color="error">
                        {deadlineError}
                      </Typography>
                    ) : deadline ? (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarIcon sx={{ fontSize: 16, color: '#0058be' }} />
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                              Học kỳ {deadline.semesterCode || selectedProject?.semesterCode || 'hiện tại'}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 800,
                              color: deadline.canBorrow === false ? '#dc2626' : '#0058be',
                              fontSize: 13,
                            }}
                          >
                            {formatVietnamDate(deadline.dueDate)}
                            {typeof deadline.daysLeft === 'number'
                              ? deadline.daysLeft >= 0
                                ? ` (còn ${deadline.daysLeft} ngày)`
                                : ' (đã quá hạn)'
                              : ''}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11.5, mt: 0.5, display: 'block' }}>
                          Hạn trả cố định theo học kỳ của lớp, sinh viên không tự chọn ngày.
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Chọn đề tài đã duyệt để xem hạn trả theo học kỳ.
                      </Typography>
                    )}
                  </Paper>
                </Box>

                {/* 3. BẢNG LINH KIỆN ĐÃ CHỌN */}
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.75, display: 'block', fontSize: 12 }}>
                  LINH KIỆN MƯỢN THÊM ({selectedItems.length}) *
                </Typography>
                <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5, mb: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#fafbff' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>
                          LINH KIỆN
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center', width: 135 }}>
                          SỐ LƯỢNG
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>
                          GHI CHÚ (TÙY CHỌN)
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center', width: 48 }}>
                          XÓA
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: '#81899a', fontSize: 12.5 }}>
                            Chưa chọn linh kiện nào. Hãy bấm nút <strong>+ Chọn</strong> ở danh mục bên trái.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedItems.map((item) => {
                          const maxQty = Math.min(1000, Math.max(1, item.borrowableQuantity || 1))
                          return (
                            <TableRow key={item.componentId} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 12.5 }}>
                                  {item.componentName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                                  {item.componentCode} · Khả dụng: {item.borrowableQuantity} {item.unit}
                                </Typography>
                              </TableCell>

                              <TableCell sx={{ textAlign: 'center' }}>
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #dcdfe6', borderRadius: 1, px: 0.4 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(item.componentId, item.quantity - 1)}
                                    disabled={item.quantity <= 1}
                                    sx={{ p: 0.3 }}
                                  >
                                    <RemoveIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleQuantityChange(item.componentId, e.target.value)}
                                    slotProps={{
                                      htmlInput: {
                                        min: 1,
                                        max: maxQty,
                                        style: { textAlign: 'center', padding: '2px 4px', width: 38, fontWeight: 800, fontSize: 13 },
                                      },
                                    }}
                                    sx={{
                                      '& fieldset': { border: 'none' },
                                      '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0,
                                      },
                                    }}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(item.componentId, item.quantity + 1)}
                                    disabled={item.quantity >= maxQty}
                                    sx={{ p: 0.3 }}
                                  >
                                    <AddIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Box>
                              </TableCell>

                              <TableCell>
                                <TextField
                                  fullWidth
                                  size="small"
                                  placeholder="Ghi chú ngắn..."
                                  value={item.note || ''}
                                  onChange={(e) => handleNoteChange(item.componentId, e.target.value)}
                                  slotProps={{ htmlInput: { maxLength: NOTE_MAX_LENGTH } }}
                                  sx={{
                                    '& .MuiOutlinedInput-root': {
                                      fontSize: 12,
                                      borderRadius: 1,
                                    },
                                  }}
                                />
                              </TableCell>

                              <TableCell sx={{ textAlign: 'center' }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleRemoveItem(item.componentId)}
                                  sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {selectedItems.length > 0 && (
                  <Alert
                    severity="success"
                    icon={<CheckCircleIcon fontSize="small" sx={{ color: '#16a34a' }} />}
                    sx={{
                      mb: 2,
                      borderRadius: 1.5,
                      bgcolor: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0',
                      py: 0.5,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Giảng viên phụ trách lớp sẽ duyệt đơn mượn thêm này. Danh sách linh kiện đã duyệt trước đó của đề tài vẫn giữ nguyên.
                  </Alert>
                )}
              </Box>

              {/* Bottom Actions Bar */}
              <Box
                sx={{
                  pt: 2,
                  borderTop: '1px solid #f0f2f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Typography variant="body2" sx={{ color: '#424754', fontWeight: 700, fontSize: 13 }}>
                  {selectedItems.length} loại · Tổng {totalCount} linh kiện
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/borrow/my-requests')}
                    disabled={submitting}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      borderRadius: 1.5,
                      borderColor: '#dcdfe6',
                      color: '#424754',
                      px: 2.5,
                    }}
                  >
                    Hủy
                  </Button>

                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting || !canSubmitForProject || selectedItems.length === 0 || !reason.trim()}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      bgcolor: '#0058be',
                      px: 3,
                      py: 1,
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 800,
                      fontSize: 13,
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#0049a3' },
                    }}
                  >
                    {submitting ? 'Đang gửi...' : 'Gửi giảng viên'}
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((prev) => ({ ...prev, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
