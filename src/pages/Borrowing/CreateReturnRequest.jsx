import { useState, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Grid,
  IconButton,
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
  Check as CheckIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import {
  borrowService,
  MOCK_ORIGINAL_BORROWS,
} from '../../services/borrowService'
import { useAuth } from '../../context/AuthContext'

/**
 * CreateReturnRequest Component (Actor: Sinh viên / Trưởng nhóm)
 * Tạo phiếu trả linh kiện gửi đến Lab (Ảnh 1 & 2 - MF5.2)
 */
export default function CreateReturnRequest() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const currentUser = user || {
    name: 'Lê Hoàng Nam',
    studentCode: '20214589',
    teamName: 'Nhóm 07 – IoT',
  }

  // Danh sách đơn mượn có thể trả
  const originalBorrows = MOCK_ORIGINAL_BORROWS
  const [selectedBorrowCode, setSelectedBorrowCode] = useState('BR-2026-1020')

  // Danh sách linh kiện đang mượn từ đơn gốc
  const borrowedComponentsList = useMemo(() => [
    {
      componentId: 'comp-esp32',
      componentCode: 'MCU-ESP32',
      componentName: 'ESP32 DevKit',
      borrowedQuantity: 1,
    },
    {
      componentId: 'comp-dht22',
      componentCode: 'SEN-DHT22',
      componentName: 'Cảm biến DHT22',
      borrowedQuantity: 2,
    },
  ], [])

  // Các linh kiện được chọn để trả
  const [returnItems, setReturnItems] = useState([
    {
      componentId: 'comp-esp32',
      componentCode: 'MCU-ESP32',
      componentName: 'ESP32 DevKit',
      borrowedQuantity: 1,
      returnQuantity: 1,
    },
    {
      componentId: 'comp-dht22',
      componentCode: 'SEN-DHT22',
      componentName: 'Cảm biến DHT22',
      borrowedQuantity: 2,
      returnQuantity: 2,
    },
  ])

  // Form metadata
  const [returnDate, setReturnDate] = useState('2026-10-29')
  const [returnLocation, setReturnLocation] = useState('Phòng thực hành IoT · B1-302')
  const [note, setNote] = useState(
    'Nhóm đã hoàn thành mô hình IoT, xin trả 1 ESP32 DevKit và 2 cảm biến DHT22 đã nhận.'
  )
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' })

  // Toggle chọn linh kiện để trả
  const handleToggleItem = (comp) => {
    const isSelected = returnItems.some((i) => i.componentId === comp.componentId)
    if (isSelected) {
      setReturnItems((prev) => prev.filter((i) => i.componentId !== comp.componentId))
    } else {
      setReturnItems((prev) => [
        ...prev,
        {
          componentId: comp.componentId,
          componentCode: comp.componentCode,
          componentName: comp.componentName,
          borrowedQuantity: comp.borrowedQuantity,
          returnQuantity: comp.borrowedQuantity,
        },
      ])
    }
  }

  // Tăng giảm số lượng trả
  const handleQuantityChange = (componentId, delta) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.componentId === componentId) {
          const newQty = Math.max(1, Math.min(item.borrowedQuantity, item.returnQuantity + delta))
          return { ...item, returnQuantity: newQty }
        }
        return item
      })
    )
  }

  // Tổng số lượng trả
  const totalReturnCount = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + item.returnQuantity, 0)
  }, [returnItems])

  // Gửi phiếu trả
  const handleSubmit = async () => {
    if (returnItems.length === 0) {
      setToast({ open: true, message: 'Vui lòng chọn ít nhất 1 linh kiện cần trả', severity: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        originalBorrowCode: selectedBorrowCode,
        leaderName: currentUser.name,
        leaderCode: currentUser.studentCode,
        teamName: currentUser.teamName,
        returnDate,
        returnLocation,
        note: note.trim(),
        components: returnItems.map((item) => ({
          ...item,
          remainingQuantity: item.borrowedQuantity - item.returnQuantity,
        })),
      }

      const res = await borrowService.createReturnRequest(payload)
      setToast({ open: true, message: 'Đã gửi phiếu trả đến Lab thành công!', severity: 'success' })

      setTimeout(() => {
        navigate(`/borrow/return/${res.returnId || 'TR-2026-014'}`)
      }, 700)
    } catch (err) {
      setToast({ open: true, message: err.message || 'Gửi phiếu trả thất bại', severity: 'error' })
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
            Trả linh kiện
          </Typography>
        </Box>

        {/* Page Title */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 24, mb: 0.5 }}>
            Tạo phiếu trả linh kiện
          </Typography>
          <Typography variant="body2" sx={{ color: '#556070', fontSize: 13 }}>
            Chọn linh kiện đang mượn và số lượng cần trả để gửi trực tiếp đến Lab.
          </Typography>
        </Box>

        {/* Top Info Bar: Trưởng nhóm, Nhóm thực hành, Đơn mượn gốc */}
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
                {currentUser.name} · {currentUser.studentCode}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
                NHÓM THỰC HÀNH
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', mt: 0.2 }}>
                {currentUser.teamName}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, letterSpacing: 0.5, display: 'block' }}>
              ĐƠN MƯỢN GỐC
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0058be', mt: 0.2 }}>
              {selectedBorrowCode}
            </Typography>
          </Box>
        </Paper>

        {/* 2-Column Grid: Cột trái (Linh kiện đang mượn) & Cột phải (Nội dung phiếu trả) */}
        <Grid container spacing={3}>
          {/* CỘT TRÁI: LINH KIỆN ĐANG MƯỢN */}
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
                  Linh kiện đang mượn
                </Typography>
                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 12 }}>
                  {selectedBorrowCode} · {borrowedComponentsList.length} loại có thể trả
                </Typography>
              </Box>

              {/* Dropdown chọn đơn */}
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" sx={{ color: '#81899a', fontWeight: 800, fontSize: 10, display: 'block', mb: 0.5 }}>
                  ĐƠN MƯỢN ĐƯỢC CHỌN
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={selectedBorrowCode}
                  onChange={(e) => setSelectedBorrowCode(e.target.value)}
                  sx={{ borderRadius: 1.5, height: 38, fontSize: 13, fontWeight: 700, bgcolor: '#fafbff' }}
                >
                  {originalBorrows.map((b) => (
                    <MenuItem key={b.borrowRequestId} value={b.requestCode} sx={{ fontSize: 13, fontWeight: 700 }}>
                      {b.requestCode}
                    </MenuItem>
                  ))}
                </Select>
              </Box>

              {/* Danh sách linh kiện đang mượn */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                {borrowedComponentsList.map((comp) => {
                  const isSelected = returnItems.some((i) => i.componentId === comp.componentId)
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
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleItem(comp)}
                          size="small"
                          sx={{ p: 0.2, color: '#0058be', '&.Mui-checked': { color: '#0058be' } }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13, lineHeight: 1.2 }}>
                            {comp.componentName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                            {comp.componentCode}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 3.5, pt: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#424754', fontSize: 12 }}>
                          Đang mượn: <strong>{comp.borrowedQuantity} chiếc</strong>
                        </Typography>

                        <Button
                          size="small"
                          variant={isSelected ? 'tonal' : 'outlined'}
                          onClick={() => handleToggleItem(comp)}
                          startIcon={isSelected ? <CheckIcon sx={{ fontSize: 14 }} /> : null}
                          sx={{
                            height: 28,
                            fontSize: 11,
                            fontWeight: 800,
                            textTransform: 'none',
                            borderRadius: 1,
                            bgcolor: isSelected ? '#eaedff' : 'transparent',
                            color: isSelected ? '#0058be' : '#424754',
                            borderColor: isSelected ? '#eaedff' : '#dcdfe6',
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
                Linh kiện đã bàn giao ngày 22/10/2026. Hạn trả: 29/10/2026.
              </Typography>
            </Paper>
          </Grid>

          {/* CỘT PHẢI: NỘI DUNG PHIẾU TRẢ */}
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
                      Nội dung phiếu trả
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#81899a', fontSize: 12 }}>
                      Phiếu dự kiến: <strong>TR-2026-014</strong>
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

                {/* Bảng linh kiện trả */}
                <TableContainer sx={{ border: '1px solid #f0f2f5', borderRadius: 1.5, mb: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#fafbff' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', py: 1.2 }}>Linh kiện</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>Đang mượn</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>SL trả</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#6b7280', textAlign: 'center' }}>Còn lại</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {returnItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: '#81899a', fontSize: 12 }}>
                            Chưa chọn linh kiện nào để trả
                          </TableCell>
                        </TableRow>
                      ) : (
                        returnItems.map((item) => {
                          const remaining = item.borrowedQuantity - item.returnQuantity
                          return (
                            <TableRow key={item.componentId} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#131b2e', fontSize: 13 }}>
                                  {item.componentName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11 }}>
                                  {item.componentCode}
                                </Typography>
                              </TableCell>

                              <TableCell sx={{ textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#424754' }}>
                                {item.borrowedQuantity}
                              </TableCell>

                              {/* Bộ tăng giảm số lượng trả */}
                              <TableCell sx={{ textAlign: 'center' }}>
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #dcdfe6', borderRadius: 1, px: 0.5 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(item.componentId, -1)}
                                    disabled={item.returnQuantity <= 1}
                                    sx={{ p: 0.3 }}
                                  >
                                    <RemoveIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                  <Typography sx={{ width: 26, textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
                                    {item.returnQuantity}
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(item.componentId, 1)}
                                    disabled={item.returnQuantity >= item.borrowedQuantity}
                                    sx={{ p: 0.3 }}
                                  >
                                    <AddIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Box>
                              </TableCell>

                              <TableCell sx={{ textAlign: 'center', fontWeight: 800, fontSize: 13, color: remaining === 0 ? '#16a34a' : '#b45309' }}>
                                {remaining}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Alert xanh số lượng hợp lệ */}
                {returnItems.length > 0 && (
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
                    Hợp lệ · Số lượng trả không vượt số lượng đang mượn.
                  </Alert>
                )}

                {/* Grid Inputs: Ngày trả dự kiến & Địa điểm trả */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.8, display: 'block', fontSize: 12 }}>
                      Ngày trả dự kiến *
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 42, fontSize: 13 } }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.8, display: 'block', fontSize: 12 }}>
                      Địa điểm trả
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={returnLocation}
                      onChange={(e) => setReturnLocation(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, height: 42, fontSize: 13, bgcolor: '#f8fafc' } }}
                    />
                  </Grid>
                </Grid>

                {/* Ghi chú cho Lab */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#263247', mb: 0.8, display: 'block', fontSize: 12 }}>
                    Ghi chú cho Lab
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={2.5}
                    size="small"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú về tình trạng thiết bị khi bàn giao lại cho phòng Lab..."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
                  />
                </Box>

                <Typography variant="caption" sx={{ color: '#81899a', fontSize: 11, fontStyle: 'italic', display: 'block', mb: 2 }}>
                  Mang linh kiện đến Lab theo lịch trả. Lab sẽ chụp ảnh, đối chiếu bằng chứng bàn giao và kiểm tra thực tế trước khi xác nhận.
                </Typography>
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
                  Đã chọn: {returnItems.length} loại · {totalReturnCount} chiếc
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
                    disabled={submitting || returnItems.length === 0}
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
                    {submitting ? 'Đang gửi...' : 'Gửi phiếu trả'}
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
