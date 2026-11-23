import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputBase,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  Clear as ClearIcon,
  PhotoCameraOutlined as CameraIcon,
  Search as SearchIcon,
  TableRows as TableViewIcon,
  GridView as GridViewIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import { inventoryService } from '../../services/inventoryService'
import { extractErrorMessage } from '../../services/api'
import {
  getComponentImage,
  getComponentShortCode,
  normalizeSearchText,
} from './componentHelpers'

/**
 * ComponentCatalog: Màn hình hiển thị danh mục linh kiện có hình ảnh dạng lưới (Catalog / E-commerce)
 * Dành cho Giảng viên, Sinh viên và Nhân viên xem, lướt và tra cứu trực quan.
 */
export default function ComponentCatalog() {
  const navigate = useNavigate()
  const [components, setComponents] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  // Tải danh sách linh kiện và danh mục từ API
  useEffect(() => {
    let active = true
    Promise.all([
      inventoryService.getComponents().catch(() => []),
      inventoryService.getCategories().catch(() => []),
    ])
      .then(([compList, catList]) => {
        if (!active) return
        setComponents(Array.isArray(compList) ? compList : [])
        setCategories(Array.isArray(catList) ? catList : [])
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(extractErrorMessage(err, 'Không thể tải danh mục linh kiện.'))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Danh sách các danh mục duy nhất để hiển thị thanh chọn ngang (Tabs/Chips)
  const categoryChips = useMemo(() => {
    const list = [{ id: '', name: 'Tất cả' }]
    const seen = new Set()

    // Lấy từ categories API
    categories.forEach((cat) => {
      const name = cat.categoryName || cat.name
      if (name && !seen.has(name)) {
        seen.add(name)
        list.push({ id: cat.categoryId || cat.id || name, name })
      }
    })

    // Bổ sung các danh mục xuất hiện trực tiếp trong components
    components.forEach((c) => {
      if (c.categoryName && !seen.has(c.categoryName)) {
        seen.add(c.categoryName)
        list.push({ id: c.categoryId || c.categoryName, name: c.categoryName })
      }
    })

    return list
  }, [categories, components])

  // Lọc linh kiện theo từ khóa tìm kiếm và danh mục được chọn
  const filteredComponents = useMemo(() => {
    return components.filter((comp) => {
      // 1. Lọc theo danh mục
      if (selectedCategory) {
        const catName = comp.categoryName || ''
        const catId = comp.categoryId || comp.CategoryId
        if (catName !== selectedCategory && catId !== selectedCategory) {
          return false
        }
      }

      // 2. Lọc theo tên, mã hệ thống hoặc mã viết tắt (không dấu)
      if (search.trim()) {
        const term = normalizeSearchText(search)
        const target = normalizeSearchText(
          `${comp.componentName || ''} ${comp.componentCode || ''} ${getComponentShortCode(comp)} ${comp.description || ''} ${comp.manufacturer || ''}`
        )
        if (!target.includes(term)) {
          return false
        }
      }

      return true
    })
  }, [components, selectedCategory, search])

  return (
    <PortalLayout
      headerTitle="Tra cứu linh kiện"
      headerSubtitle="Khám phá danh mục linh kiện, thông số và tồn kho thực tế"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 6 }}>
        {/* Thanh tìm kiếm và chuyển đổi chế độ xem (Thiết kế đúng theo hình 2) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
          }}
        >
          {/* Ô tìm kiếm viên thuốc */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#ffffff',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
              px: 2,
              py: 0.6,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              '&:focus-within': {
                borderColor: '#94a3b8',
              },
            }}
          >
            <SearchIcon sx={{ color: '#94a3b8', fontSize: 20, mr: 1, flexShrink: 0 }} />
            <InputBase
              fullWidth
              placeholder="Tìm theo tên hoặc mã"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                fontSize: 14,
                color: '#1e293b',
                '& ::placeholder': {
                  color: '#9ca3af',
                  opacity: 1,
                },
              }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch('')} sx={{ p: 0.25, color: '#94a3b8' }}>
                <ClearIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>

          <Button
            variant="outlined"
            startIcon={viewMode === 'grid' ? <TableViewIcon /> : <GridViewIcon />}
            onClick={() => setViewMode((current) => (current === 'grid' ? 'table' : 'grid'))}
            sx={{
              borderRadius: '9999px',
              borderColor: '#e2e8f0',
              bgcolor: '#ffffff',
              color: '#475569',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              px: 2,
              py: 0.8,
              whiteSpace: 'nowrap',
              '&:hover': {
                bgcolor: '#f8fafc',
                borderColor: '#cbd5e1',
              },
            }}
          >
            {viewMode === 'grid' ? 'Dạng bảng' : 'Dạng lưới'}
          </Button>
        </Box>

        {/* Thanh phân loại danh mục cuộn ngang (Horizontal Category Chips) */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            py: 0.5,
            mb: 2,
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {categoryChips.map((chip) => {
            const isSelected = selectedCategory === chip.name || (chip.id === '' && selectedCategory === '')
            return (
              <Chip
                key={chip.id || 'all'}
                label={chip.name}
                clickable
                onClick={() => setSelectedCategory(chip.id === '' ? '' : chip.name)}
                sx={{
                  borderRadius: '9999px',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13,
                  px: 1.25,
                  py: 2,
                  bgcolor: isSelected ? '#0058be' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  border: isSelected ? 'none' : '1px solid #e2e8f0',
                  boxShadow: isSelected ? '0 2px 4px rgba(0, 88, 190, 0.25)' : 'none',
                  '&:hover': {
                    bgcolor: isSelected ? '#004aa3' : '#f8fafc',
                  },
                }}
              />
            )
          })}
        </Box>

        {/* Dòng tóm tắt số lượng */}
        <Typography sx={{ fontSize: 13, color: '#64748b', fontWeight: 500, mb: 2 }}>
          {filteredComponents.length} linh kiện, kể cả ngừng dùng
        </Typography>

        {/* Trạng thái đang tải */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
            <CircularProgress size={36} sx={{ color: '#0058be', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Đang tải danh mục linh kiện...
            </Typography>
          </Box>
        )}

        {/* Thông báo lỗi */}
        {error && (
          <Typography color="error" sx={{ py: 4, textAlign: 'center' }}>
            {error}
          </Typography>
        )}

        {/* Danh sách linh kiện dạng lưới (E-commerce Grid Cards - Đúng theo Hình 2) */}
        {!loading && !error && viewMode === 'table' && filteredComponents.length > 0 && (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, borderColor: '#e2e8f0' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' } }}>
                  <TableCell sx={{ width: 64 }}>Ảnh</TableCell>
                  <TableCell>Linh kiện</TableCell>
                  <TableCell>Danh mục</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell align="right">Còn</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredComponents.map((component) => {
                  const imgUrl = getComponentImage(component)
                  const availableQty = Number(component.availableQuantity ?? component.stock ?? 0)
                  const unit = component.unit || 'cái'
                  return (
                    <TableRow
                      key={component.componentId || component.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() =>
                        navigate(`/components/${component.componentId || component.id}`, { state: { component } })
                      }
                    >
                      <TableCell>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            bgcolor: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {imgUrl ? (
                            <Box component="img" src={imgUrl} alt={component.componentName} loading="lazy"
                              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          ) : (
                            <CameraIcon sx={{ fontSize: 20, color: '#cbd5e1' }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: '#1e293b' }}>{component.componentName}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                          {component.componentCode}
                          {getComponentShortCode(component) ? ` · ${getComponentShortCode(component)}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, color: '#475569' }}>{component.categoryName || '—'}</TableCell>
                      <TableCell><TrackingTypeBadge type={component.trackingType} /></TableCell>
                      <TableCell align="right" sx={{ fontSize: 13, fontWeight: 600, color: availableQty > 0 ? '#0f172a' : '#94a3b8' }}>
                        {availableQty > 0 ? `${availableQty.toLocaleString('vi-VN')} ${unit}` : 'Hết hàng'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && !error && viewMode === 'grid' && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: { xs: 1.5, sm: 2.25 },
            }}
          >
            {filteredComponents.map((component) => {
              const imgUrl = getComponentImage(component)
              const availableQty = Number(component.availableQuantity ?? component.stock ?? 0)
              const isAvailable = availableQty > 0
              const unit = component.unit || 'cái'

              return (
                <Card
                  key={component.componentId || component.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderColor: '#e2e8f0',
                    bgcolor: '#ffffff',
                    transition: 'all 0.18s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
                      borderColor: '#cbd5e1',
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() =>
                      navigate(
                        `/components/${component.componentId || component.id}`,
                        { state: { component } }
                      )
                    }
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      height: '100%',
                      p: 0,
                    }}
                  >
                    {/* Khu vực ảnh linh kiện (Image box) */}
                    <Box
                      sx={{
                        width: '100%',
                        height: { xs: 150, sm: 180, md: 200 },
                        bgcolor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 1.5,
                        position: 'relative',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      {imgUrl ? (
                        <Box
                          component="img"
                          src={imgUrl}
                          alt={component.componentName}
                          loading="lazy"
                          sx={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      ) : (
                        // Placeholder icon máy ảnh khi chưa có ảnh (Đúng theo hình 2)
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f8fafc',
                            borderRadius: 2,
                            color: '#cbd5e1',
                          }}
                        >
                          <CameraIcon sx={{ fontSize: { xs: 36, sm: 44 } }} />
                        </Box>
                      )}
                    </Box>

                    {/* Thông tin linh kiện */}
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: { xs: 13.5, sm: 14.5 },
                          color: '#1e293b',
                          lineHeight: 1.35,
                          mb: 0.75,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: 38,
                        }}
                      >
                        {component.componentName}
                      </Typography>

                      {/* Dòng trạng thái tồn kho: Dấu chấm xanh + Còn x cái (Đúng theo hình 2) */}
                      <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center' }}>
                        <Box
                          component="span"
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            bgcolor: isAvailable ? '#10b981' : '#94a3b8',
                            display: 'inline-block',
                            mr: 0.75,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: isAvailable ? '#475569' : '#94a3b8',
                          }}
                        >
                          {isAvailable ? `Còn ${availableQty.toLocaleString('vi-VN')} ${unit}` : 'Hết hàng'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              )
            })}
          </Box>
        )}

        {/* Trạng thái không tìm thấy kết quả */}
        {!loading && !error && filteredComponents.length === 0 && (
          <Box sx={{ py: 8, textAlign: 'center', bgcolor: '#ffffff', borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="body1" sx={{ color: '#475569', fontWeight: 600, mb: 1 }}>
              Không tìm thấy linh kiện nào
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
              Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục &quot;Tất cả&quot;.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSearch('')
                setSelectedCategory('')
              }}
              sx={{ textTransform: 'none', borderRadius: '9999px' }}
            >
              Xem tất cả linh kiện
            </Button>
          </Box>
        )}
      </Box>
    </PortalLayout>
  )
}
