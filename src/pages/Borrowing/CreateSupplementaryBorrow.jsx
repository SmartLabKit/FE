import { useState, useEffect, useMemo } from 'react'
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
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  DeleteOutlined as DeleteIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Memory as MemoryIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import {
  borrowService,
  MOCK_ORIGINAL_BORROWS,
  MOCK_AVAILABLE_COMPONENTS,
} from '../../services/borrowService'
import { useAuth } from '../../context/AuthContext'

/**
 * CreateSupplementaryBorrow Component (Actor: Sinh viên / Trưởng nhóm)
 * Giao diện Tạo phiếu mượn bổ sung theo đúng thiết kế Figma
 */
export default function CreateSupplementaryBorrow() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  // Thông tin nhóm & sinh viên
  const currentUser = user || {
    name: 'Lê Hoàng Nam',
    studentCode: '20214589',
    teamName: 'Nhóm 07 – IoT',
  }

  // Danh sách đơn mượn gốc
  const originalBorrows = MOCK_ORIGINAL_BORROWS
  const [selectedBorrowCode, setSelectedBorrowCode] = useState('BR-2026-1020')

  // Đơn gốc hiện tại
  const currentBorrow = useMemo(() => {
    return (
      originalBorrows.find((b) => b.requestCode === selectedBorrowCode) ||
      originalBorrows[0]
    )
  }, [originalBorrows, selectedBorrowCode])

  // Danh mục linh kiện
  const [availableComponents, setAvailableComponents] = useState(MOCK_AVAILABLE_COMPONENTS)
  const [searchComponent, setSearchComponent] = useState('')

  // Linh kiện đã chọn trong phiếu bổ sung (hỗ trợ pre-fill khi tạo lại từ phiếu bị từ chối)
  const [selectedItems, setSelectedItems] = useState(() => {
    if (location.state?.prefill?.components) {
      return location.state.prefill.components
    }
    return [
      {
        componentId: 'comp-esp32',
        componentCode: 'MCU-ESP32',
        componentName: 'ESP32 DevKit',
        availableQuantity: 12,
        quantity: 1,
        dueDate: '2026-10-29',
      },
      {
        componentId: 'comp-dht22',
        componentCode: 'SEN-DHT22',
        componentName: 'Cảm biến DHT22',
        availableQuantity: 20,
        quantity: 2,
        dueDate: '2026-10-29',
      },
    ]
  })

  // Form thông tin chung
  const [dueDate, setDueDate] = useState(() => location.state?.prefill?.dueDate || '2026-10-29')
  const [reason, setReason] = useState(
    () =>
      location.state?.prefill?.reason ||
      'Bổ sung bộ điều khiển và cảm biến để hoàn thiện mô hình IoT của nhóm.'
  )
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Tải danh mục linh kiện
  useEffect(() => {
    let ignore = false
    borrowService
      .getAvailableComponents(searchComponent)
      .then((data) => {
        if (!ignore && data) setAvailableComponents(data)
      })
      .catch((err) => console.warn(err))
    return () => {
      ignore = true
    }
  }, [searchComponent])

  // Toggle chọn linh kiện
  const handleToggleComponent = (comp) => {
    const isSelected = selectedItems.some((i) => i.componentId === comp.componentId)
    if (isSelected) {
      setSelectedItems((prev) => prev.filter((i) => i.componentId !== comp.componentId))
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          componentId: comp.componentId,
          componentCode: comp.componentCode,
          componentName: comp.componentName,
          availableQuantity: comp.availableQuantity,
          quantity: 1,
          dueDate: dueDate || currentBorrow?.dueDate || '2026-10-29',
        },
      ])
    }
  }

  // Tăng/giảm số lượng
  const handleQuantityChange = (componentId, delta) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.componentId === componentId) {
          const newQty = Math.max(1, Math.min(item.availableQuantity, item.quantity + delta))
          return { ...item, quantity: newQty }
        }
        return item
      })
    )
  }

  // Xóa linh kiện khỏi phiếu
  const handleRemoveItem = (componentId) => {
    setSelectedItems((prev) => prev.filter((i) => i.componentId !== componentId))
  }

  // Tổng số lượng
  const totalCount = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.quantity, 0)
  }, [selectedItems])

  // Gửi yêu cầu mượn bổ sung
  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      setToast({ open: true, message: 'Vui lòng chọn ít nhất 1 linh kiện bổ sung', severity: 'warning' })
      return
    }
    if (!reason.trim()) {
      setToast({ open: true, message: 'Vui lòng nhập lý do mượn bổ sung', severity: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        originalBorrowCode: currentBorrow?.requestCode || 'BR-2026-1020',
        leaderName: currentUser.name || 'Lê Hoàng Nam',
        leaderCode: currentUser.studentCode || '20214589',
        teamName: currentUser.teamName || 'Nhóm 07 – IoT',
        lecturerName: currentBorrow?.lecturerName || 'Nguyễn Văn Minh',
        reason: reason.trim(),
        dueDate,
        components: selectedItems,
      }

      const res = await borrowService.createSupplementaryBorrow(currentBorrow?.projectId || 'proj-001', payload)
      setToast({ open: true, message: 'Tạo phiếu mượn bổ sung thành công!', severity: 'success' })

      setTimeout(() => {
        navigate(`/borrow/supplementary/${res.supplementaryId || 'BS-2026-014'}`)
      }, 700)
    } catch (err) {
      setToast({ open: true, message: err.message || 'Gửi yêu cầu thất bại', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PortalLayout
      headerTitle="Quản lý mượn linh kiện"
      headerSubtitle="Phòng thực hành IoT · Học kỳ 1, 2026–2027"
    >
      <Container maxWidth="xl" disableGutters sx={{ maxWidth: 1240, mx: 'auto' }}>
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
            Mượn bổ sung
          </Typography>
        </Box>

        {/* Page Title */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
            Tạo phiếu mượn bổ sung
          </Typography>
          <Typography variant="body2" sx={{ color: '#556070', fontSize: 13 }}>
            Chọn linh kiện cần bổ sung cho đơn mượn hiện tại và gửi giảng viên duyệt.
          </Typography>
        </Box>

        {/* Top Info Bar: Trưởng nhóm, Nhóm thực hành, Đơn gốc được chọn */}
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
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                TRƯỞNG NHÓM
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                {currentUser.name || 'Lê Hoàng Nam'} · {currentUser.studentCode || '20214589'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                NHÓM THỰC HÀNH
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                {currentUser.teamName || 'Nhóm 07 – IoT'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ minWidth: 220 }}>
            <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
              ĐƠN GỐC ĐƯỢC CHỌN
            </Typography>
            <Select
              size="small"
              value={selectedBorrowCode}
              onChange={(e) => setSelectedBorrowCode(e.target.value)}
              sx={{
                borderRadius: 1.5,
                height: 38,
                fontSize: 13,
                fontWeight: 800,
                color: '#0058be',
                bgcolor: '#fafbff',
              }}
            >
              {originalBorrows.map((b) => (
                <MenuItem key={b.borrowRequestId} value={b.requestCode} sx={{ fontSize: 13, fontWeight: 700 }}>
                  {b.requestCode} ({b.projectTitle})
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Paper>

        {/* 2-Column Split: Cột trái (Danh mục linh kiện) & Cột phải (Nội dung phiếu) */}
        <Grid container spacing={3}>
          {/* CỘT TRÁI: DANH MỤC LINH KIỆN */}
          <Grid item xs={12} md={4.5}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid #e4e6ef',
                bgcolor: '#ffffff',
                height: '100%',
              }}
            >
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 15 }}>
                  Danh mục linh kiện
                </Typography>
                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 12 }}>
                  {availableComponents.length} linh kiện phù hợp
                </Typography>
              </Box>

              {/* Tìm kiếm */}
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm tên hoặc mã linh kiện"
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

              {/* Danh sách linh kiện */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                {availableComponents.map((comp) => {
                  const isSelected = selectedItems.some((i) => i.componentId === comp.componentId)
                  return (
                    <Paper
                      key={comp.componentId}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        border: isSelected ? '1.5px solid #0058be' : '1px solid #e4e6ef',
                        bgcolor: isSelected ? '#fafbff' : '#ffffff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, mb: 1 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
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
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13, lineHeight: 1.2 }}>
                            {comp.componentName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                            {comp.componentCode}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#424754', fontSize: 12 }}>
                          Khả dụng: <strong>{comp.availableQuantity}</strong>
                        </Typography>

                        <Button
                          size="small"
                          variant={isSelected ? 'tonal' : 'outlined'}
                          onClick={() => handleToggleComponent(comp)}
                          startIcon={isSelected ? <CheckIcon sx={{ fontSize: 14 }} /> : <AddIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            height: 28,
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: 'none',
                            borderRadius: 1,
                            bgcolor: isSelected ? '#eaedff' : 'transparent',
                            color: isSelected ? '#0058be' : '#424754',
                            borderColor: isSelected ? '#eaedff' : '#dcdfe6',
                            '&:hover': {
                              bgcolor: isSelected ? '#dce3ff' : '#f4f6fa',
                            },
                          }}
                        >
                          {isSelected ? 'Đã chọn' : 'Chọn'}
                        </Button>
                      </Box>
                    </Paper>
                  )
                })}
              </Box>

              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11, display: 'block', fontStyle: 'italic' }}>
                Tồn khả dụng được kiểm tra lại khi gửi yêu cầu duyệt.
              </Typography>
            </Paper>
          </Grid>

          {/* CỘT PHẢI: NỘI DUNG PHIẾU BỔ SUNG */}
          <Grid item xs={12} md={7.5}>
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
              }}
            >
              <Box>
                {/* Header phiếu */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 16 }}>
                      Nội dung phiếu bổ sung
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#81899a', fontSize: 12 }}>
                      Phiếu dự kiến: <strong>BS-2026-014</strong>
                    </Typography>
                  </Box>
                  <Chip
                    label="Bản nháp"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: '#f1f5f9',
                      color: '#475569',
                      borderRadius: 1,
                    }}
                  />
                </Box>

                {/* Bảng linh kiện được chọn */}
                <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5, mb: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#fafbff' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>
                          Linh kiện
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
                          Số lượng
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280' }}>
                          Hạn trả
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center', width: 48 }}>
                          Xóa
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: '#81899a', fontSize: 12 }}>
                            Chưa chọn linh kiện nào từ danh mục bên trái
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedItems.map((item) => (
                          <TableRow key={item.componentId} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13 }}>
                                {item.componentName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                                {item.componentCode} · Khả dụng: {item.availableQuantity}
                              </Typography>
                            </TableCell>

                            {/* Bộ tăng giảm số lượng */}
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #dcdfe6', borderRadius: 1, px: 0.5 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleQuantityChange(item.componentId, -1)}
                                  disabled={item.quantity <= 1}
                                  sx={{ p: 0.3 }}
                                >
                                  <RemoveIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                                <Typography sx={{ width: 26, textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                                  {item.quantity}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => handleQuantityChange(item.componentId, 1)}
                                  disabled={item.quantity >= item.availableQuantity}
                                  sx={{ p: 0.3 }}
                                >
                                  <AddIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                            </TableCell>

                            <TableCell sx={{ fontSize: 12, color: '#131b2e', fontWeight: 600 }}>
                              {item.dueDate}
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
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Alert xanh xác nhận số lượng hợp lệ */}
                {selectedItems.length > 0 && (
                  <Alert
                    severity="success"
                    icon={<CheckCircleIcon fontSize="small" sx={{ color: '#16a34a' }} />}
                    sx={{
                      mb: 2.5,
                      borderRadius: 1.5,
                      bgcolor: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0',
                      py: 0.5,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Số lượng hợp lệ:{' '}
                    {selectedItems
                      .map((item) => `${item.quantity}/${item.availableQuantity} ${item.componentName.split(' ')[0]}`)
                      .join(' và ')}{' '}
                    khả dụng.
                  </Alert>
                )}

                {/* Form Inputs: Hạn trả chung & Giảng viên duyệt */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.8, display: 'block', fontSize: 12 }}>
                      Hạn trả chung *
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 42, fontSize: 13 } }}
                    />
                    <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11, mt: 0.5, display: 'block' }}>
                      Hợp lệ · Không vượt hạn trả đơn gốc ({currentBorrow?.dueDate || '29/10'}).
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.8, display: 'block', fontSize: 12 }}>
                      Giảng viên duyệt
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={currentBorrow?.lecturerName || 'Nguyễn Văn Minh'}
                      disabled
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1.5,
                          height: 42,
                          fontSize: 13,
                          fontWeight: 700,
                          bgcolor: '#f8fafc',
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11, mt: 0.5, display: 'block' }}>
                      Theo giảng viên phụ trách nhóm.
                    </Typography>
                  </Grid>
                </Grid>

                {/* Lý do bổ sung */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.8, display: 'block', fontSize: 12 }}>
                    Lý do bổ sung *
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Nhập lý do cần mượn bổ sung linh kiện cho bài thực hành..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                  />
                </Box>
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
                  {selectedItems.length} loại · {totalCount} chiếc
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/borrow/my-requests')}
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
                    disabled={submitting || selectedItems.length === 0}
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
                    {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PortalLayout>
  )
}
