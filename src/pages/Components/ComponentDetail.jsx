import { useEffect, useState, useRef, useCallback } from 'react'
import { useEntityChanged } from '../../hooks/useEntityChanged'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from '@mui/material'
import {
  ArrowBackIosNew as BackIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  CloudUploadOutlined as UploadIcon,
  Delete as DeleteIcon,
  DescriptionOutlined as DocIcon,
  EditOutlined as EditIcon,
  Launch as LaunchIcon,
  MenuBookOutlined as TutorialIcon,
  PhotoCameraOutlined as CameraIcon,
  PhotoLibraryOutlined as GalleryIcon,
  PictureAsPdf as PdfIcon,
  PlayCircle as YoutubeIcon,
} from '@mui/icons-material'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  classifyTutorialType,
  getComponentImages,
  getComponentLatestPrice,
  getDisplayCode,
  getDatasheetInfo,
  getLabStocksForComponent,
} from './componentHelpers'

/**
 * ComponentDetail: Màn hình chi tiết linh kiện khi bấm vào từ danh mục (Đúng theo Hình 3)
 * Hiển thị ảnh lớn, thông tin tồn khả dụng, quản lý ảnh, phân bổ tồn theo từng phòng Lab, và tài liệu datasheet.
 */
export default function ComponentDetail() {
  const { componentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, hasRole } = useAuth()
  const fileInputRef = useRef(null)

  const canManage =
    user?.roleLabel === 'ADMIN' ||
    user?.roleLabel === 'INVENTORYMANAGER' ||
    hasRole?.('Admin') ||
    hasRole?.('InventoryManager')
  const hideStock = hasRole?.('Student') && !hasRole?.('Admin') && !hasRole?.('InventoryManager') && !hasRole?.('LabStaff')

  // Ưu tiên dữ liệu truyền từ state khi click thẻ danh mục, sau đó tải chi tiết từ API
  const [component, setComponent] = useState(location.state?.component || null)
  const [loading, setLoading] = useState(!component)
  const [error, setError] = useState('')

  // Danh sách ảnh và ảnh đang chọn xem chính
  const [images, setImages] = useState(() => (component ? getComponentImages(component) : []))
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // Danh sách tồn kho theo từng phòng Lab
  const [labStocks, setLabStocks] = useState([])
  const [loadingLabStocks, setLoadingLabStocks] = useState(true)

  // Danh sách bài hướng dẫn (Tutorials)
  const [tutorials, setTutorials] = useState([])

  // Modal xem album ảnh & tải ảnh lên
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [galleryNotice, setGalleryNotice] = useState('')

  // Tải thông tin chi tiết linh kiện
  // Dữ liệu đổi ở nơi khác (người khác thao tác) thì tự tải lại, không cần F5
  const [liveKey, setLiveKey] = useState(0)
  const bumpLive = useCallback(() => setLiveKey((key) => key + 1), [])
  useEntityChanged(bumpLive)

  useEffect(() => {
    let active = true
    if (!componentId) return

    inventoryService
      .getComponent(componentId)
      .then((data) => {
        if (!active) return
        if (data) {
          setComponent(data)
          const allImgs = getComponentImages(data)
          setImages(allImgs)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(extractErrorMessage(err, 'Không thể tải chi tiết linh kiện.'))
        setLoading(false)
      })

    inventoryService
      .getTutorials(componentId)
      .then((tutList) => {
        if (active) setTutorials(Array.isArray(tutList) ? tutList : [])
      })
      .catch(() => {
        if (active) setTutorials([])
      })

    return () => {
      active = false
    }
  }, [componentId, liveKey])

  // Tải phân bổ tồn kho theo từng phòng Lab
  useEffect(() => {
    let active = true
    if (!component || hideStock) return

    getLabStocksForComponent(component, inventoryService)
      .then((stocks) => {
        if (!active) return
        setLabStocks(stocks)
        setLoadingLabStocks(false)
      })
      .catch(() => {
        if (active) setLoadingLabStocks(false)
      })

    return () => {
      active = false
    }
  }, [component, hideStock])

  // Xử lý upload ảnh mới
  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !componentId) return

    setUploadingImage(true)
    setGalleryNotice('')
    try {
      const res = await inventoryService.uploadComponentImage(componentId, file)
      setImages((current) => [...current, { imageId: res.imageId, imageUrl: res.imageUrl, fileName: file.name }])
      setGalleryNotice('Đã thêm ảnh mới thành công.')
    } catch (uploadError) {
      setGalleryNotice(extractErrorMessage(uploadError, 'Không thể tải ảnh lên. Vui lòng thử lại.'))
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Xử lý xóa ảnh
  const handleDeleteImage = async (imgId) => {
    if (!componentId) return
    try {
      await inventoryService.deleteComponentImage(componentId, imgId)
      const updated = images.filter((img) => img.imageId !== imgId)
      setImages(updated)
      if (selectedImageIndex >= updated.length) {
        setSelectedImageIndex(Math.max(0, updated.length - 1))
      }
      setGalleryNotice('Đã xóa ảnh.')
    } catch (deleteError) {
      setGalleryNotice(extractErrorMessage(deleteError, 'Không thể xóa ảnh.'))
    }
  }

  if (loading && !component) {
    return (
      <PortalLayout headerTitle="Chi tiết linh kiện">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={36} sx={{ color: '#0058be' }} />
        </Box>
      </PortalLayout>
    )
  }

  if (error && !component) {
    return (
      <PortalLayout headerTitle="Chi tiết linh kiện">
        <Box sx={{ maxWidth: 680, mx: 'auto', py: 6, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          <Button variant="contained" onClick={() => navigate('/components/catalog')} sx={{ textTransform: 'none' }}>
            Quay lại danh mục linh kiện
          </Button>
        </Box>
      </PortalLayout>
    )
  }

  const currentMainImage = images[selectedImageIndex]?.imageUrl || images[0]?.imageUrl || ''
  const availableQty = Number(component?.availableQuantity ?? component?.stock ?? 0)
  const unit = component?.unit || 'cái'
  const datasheet = getDatasheetInfo(component)
  const refPrice = getComponentLatestPrice(component)

  return (
    <PortalLayout headerTitle="Chi tiết linh kiện">
      <Box sx={{ maxWidth: 640, mx: 'auto', pb: 8, px: { xs: 1.5, sm: 2 } }}>
        {/* Nút quay lại: < Linh kiện (Đúng theo hình 3) */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button
            startIcon={<BackIcon sx={{ fontSize: 13 }} />}
            onClick={() => navigate(-1)}
            sx={{
              textTransform: 'none',
              color: '#0058be',
              fontWeight: 600,
              fontSize: 14,
              p: 0,
              minWidth: 'auto',
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
            }}
          >
            Linh kiện
          </Button>

          {/* Nút sửa thông tin nếu có quyền quản trị */}
          {canManage && (
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate(`/class-setup/admin/components/${componentId}/edit`)}
              sx={{ textTransform: 'none', fontWeight: 600, color: '#475569' }}
            >
              Chỉnh sửa
            </Button>
          )}
        </Box>

        {/* Khung ảnh đại diện lớn (Đúng theo hình 3) */}
        <Box
          sx={{
            width: '100%',
            height: { xs: 240, sm: 300 },
            bgcolor: '#ffffff',
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            mb: 2.5,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          }}
        >
          {currentMainImage ? (
            <Box
              component="img"
              src={currentMainImage}
              alt={component?.componentName}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f8fafc',
                borderRadius: 2,
                color: '#cbd5e1',
              }}
            >
              <CameraIcon sx={{ fontSize: 56, mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>Chưa có hình ảnh</Typography>
            </Box>
          )}
        </Box>

        {/* Dải ảnh nhỏ nếu có nhiều hơn 1 ảnh */}
        {images.length > 1 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2.5, overflowX: 'auto', pb: 0.5 }}>
            {images.map((img, idx) => (
              <Box
                key={img.imageId || idx}
                onClick={() => setSelectedImageIndex(idx)}
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  border: idx === selectedImageIndex ? '2px solid #0058be' : '1px solid #e2e8f0',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  p: 0.5,
                  bgcolor: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <Box
                  component="img"
                  src={img.imageUrl}
                  alt={img.fileName}
                  sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </Box>
            ))}
          </Box>
        )}

        {/* Tiêu đề & Thông tin cơ bản (Đúng theo hình 3) */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              fontSize: { xs: 20, sm: 22 },
              lineHeight: 1.3,
              mb: 0.5,
            }}
          >
            {component?.componentName}
          </Typography>

          <Typography
            sx={{
              fontSize: 13.5,
              color: '#64748b',
              fontWeight: 500,
              mb: 1.5,
            }}
          >
            {getDisplayCode(component)} · {component?.categoryName || 'Linh kiện'}
          </Typography>

          {/* Badge tồn kho & giá nhập gần nhất */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {!hideStock && (
            <Chip
              label={`Còn ${availableQty.toLocaleString('vi-VN')} ${unit}`}
              size="small"
              sx={{
                bgcolor: '#ecfdf5',
                color: '#059669',
                fontWeight: 700,
                fontSize: 13,
                borderRadius: '9999px',
                height: 28,
                px: 0.5,
              }}
            />
            )}
            {refPrice > 0 && (
              <Chip
                label={`Giá nhập gần nhất: ${refPrice.toLocaleString('vi-VN')} ₫`}
                size="small"
                sx={{
                  bgcolor: '#eff6ff',
                  color: '#0058be',
                  fontWeight: 700,
                  fontSize: 12.5,
                  borderRadius: '9999px',
                  height: 28,
                  px: 0.5,
                }}
              />
            )}
          </Box>

          {/* Mô tả linh kiện */}
          {component?.description && (
            <Typography sx={{ fontSize: 14, color: '#334155', lineHeight: 1.65 }}>{component.description}</Typography>
          )}

          {/* Thông số kỹ thuật (nếu có) */}
          {component?.specifications && (
            <Typography sx={{ fontSize: 13, color: '#64748b', mt: 1 }}>
              <strong>Thông số:</strong> {component.specifications}
            </Typography>
          )}
        </Box>

        {/* KHỐI QUẢN LÝ (Ảnh - 1 ảnh (thêm, xem hoặc xoá) - Đúng theo hình 3) */}
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            {canManage ? 'QUẢN LÝ' : 'HÌNH ẢNH'}
          </Typography>

          <Box
            onClick={() => setGalleryOpen(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 1.75,
              bgcolor: '#ffffff',
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: '#f8fafc',
              },
            }}
          >
            {/* Icon vuông xanh lá cây */}
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1.75,
                flexShrink: 0,
              }}
            >
              <GalleryIcon sx={{ fontSize: 22 }} />
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#1e293b' }}>
                Ảnh
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                {images.length} ảnh{canManage ? ' (thêm, xem hoặc xoá)' : ''}
              </Typography>
            </Box>

            <ChevronRightIcon sx={{ color: '#94a3b8' }} />
          </Box>
        </Box>

        {/* KHỐI TỒN THEO LAB (Đúng theo hình 3) */}
        {!hideStock && (
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            TỒN THEO LAB
          </Typography>

          <Box
            sx={{
              bgcolor: '#ffffff',
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {loadingLabStocks ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} sx={{ color: '#0058be', mr: 1 }} />
                <Typography variant="body2" color="text.secondary">Đang tải tồn kho theo phòng...</Typography>
              </Box>
            ) : labStocks.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Chưa có phân bổ tồn kho cụ thể cho phòng lab nào.
              </Box>
            ) : (
              labStocks.map((item, index) => (
                <Box key={item.labRoomId || item.roomName || index}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 2.25,
                      py: 1.75,
                    }}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
                      {item.roomName}
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                      {item.quantity.toLocaleString('vi-VN')}
                    </Typography>
                  </Box>
                  {index < labStocks.length - 1 && <Divider sx={{ borderColor: '#f1f5f9' }} />}
                </Box>
              ))
            )}
          </Box>
        </Box>
        )}

        {/* KHỐI 1: TÀI LIỆU KỸ THUẬT (DATASHEET TỪ NHÀ SẢN XUẤT) */}
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Tài liệu kỹ thuật
          </Typography>

          <Box
            sx={{
              bgcolor: '#ffffff',
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    bgcolor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DocIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    Datasheet
                  </Typography>
                  {datasheet.url && datasheet.name && <Typography sx={{ fontSize: 12, color: '#64748b' }}>{datasheet.name}</Typography>}
                </Box>
              </Box>

              {datasheet.url ? (
                <Button
                  size="small"
                  variant="outlined"
                  href={datasheet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
                  sx={{ textTransform: 'none', borderRadius: '9999px', fontSize: 12.5, whiteSpace: 'nowrap' }}
                >
                  Xem Datasheet
                </Button>
              ) : (
                <Typography sx={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                  Chưa có file
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* KHỐI 2: HƯỚNG DẪN SỬ DỤNG (VIDEO YOUTUBE & TÀI LIỆU PDF) */}
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Hướng dẫn sử dụng
          </Typography>

          <Box
            sx={{
              bgcolor: '#ffffff',
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {tutorials.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Chưa có video YouTube hoặc PDF hướng dẫn thực hành cho linh kiện này.
              </Box>
            ) : (
              tutorials.map((tut, idx) => {
                const kind = classifyTutorialType(tut)
                const isYt = kind === 'youtube'
                const isPdf = kind === 'pdf'
                return (
                  <Box key={tut.tutorialId || tut.id || idx}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 2,
                            bgcolor: isYt ? '#fee2e2' : isPdf ? '#fef3c7' : '#e0e7ff',
                            color: isYt ? '#dc2626' : isPdf ? '#d97706' : '#4f46e5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isYt ? (
                            <YoutubeIcon sx={{ fontSize: 21 }} />
                          ) : isPdf ? (
                            <PdfIcon sx={{ fontSize: 20 }} />
                          ) : (
                            <TutorialIcon sx={{ fontSize: 20 }} />
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                            {tut.title || tut.Title || 'Hướng dẫn sử dụng'}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                            {tut.description || tut.content?.slice(0, 80) || (isYt ? 'Video hướng dẫn trên YouTube' : isPdf ? 'Tài liệu PDF hướng dẫn' : 'Chi tiết cách lắp mạch')}
                          </Typography>
                        </Box>
                      </Box>

                      {(tut.url || tut.Url) && (
                        <Button
                          size="small"
                          variant="outlined"
                          color={isYt ? 'error' : isPdf ? 'warning' : 'primary'}
                          href={tut.url || tut.Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          endIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
                          sx={{ textTransform: 'none', borderRadius: '9999px', fontSize: 12.5, whiteSpace: 'nowrap' }}
                        >
                          {isYt ? 'Xem YouTube' : isPdf ? 'Mở PDF' : 'Xem'}
                        </Button>
                      )}
                    </Box>
                    {idx < tutorials.length - 1 && <Divider sx={{ borderColor: '#f1f5f9' }} />}
                  </Box>
                )
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* DIALOG XEM & QUẢN LÝ ALBUM ẢNH */}
      <Dialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            Album ảnh ({images.length})
          </Typography>
          <IconButton size="small" onClick={() => setGalleryOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {galleryNotice && (
            <Alert severity="info" sx={{ mb: 2 }} onClose={() => setGalleryNotice('')}>
              {galleryNotice}
            </Alert>
          )}

          {images.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: '#94a3b8' }}>
              <CameraIcon sx={{ fontSize: 48, mb: 1 }} />
              <Typography>Chưa có hình ảnh nào cho linh kiện này.</Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1.5,
                mb: 2,
              }}
            >
              {images.map((img, idx) => (
                <Box
                  key={img.imageId || idx}
                  sx={{
                    position: 'relative',
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    aspectRatio: '1',
                    bgcolor: '#f8fafc',
                    p: 0.5,
                  }}
                >
                  <Box
                    component="img"
                    src={img.imageUrl}
                    alt={img.fileName}
                    sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />

                  {/* Nút xóa ảnh */}
                  {canManage && (
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteImage(img.imageId)}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'rgba(255, 255, 255, 0.85)',
                        color: '#ef4444',
                        p: 0.5,
                        '&:hover': { bgcolor: '#ffffff' },
                      }}
                      title="Xóa ảnh này"
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Input upload ảnh ẩn */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleUploadImage}
          />

          {canManage && (
            <Button
              variant="outlined"
              fullWidth
              startIcon={uploadingImage ? <CircularProgress size={18} /> : <UploadIcon />}
              disabled={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', borderRadius: 2, py: 1 }}
            >
              {uploadingImage ? 'Đang tải ảnh...' : '+ Tải thêm ảnh mới'}
            </Button>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setGalleryOpen(false)} sx={{ textTransform: 'none' }}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </PortalLayout>
  )
}
