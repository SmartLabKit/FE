import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, PersonAdd as StaffAddIcon } from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { userService } from '../../services/userService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const fields = {
  categories: {
    title: 'Danh mục linh kiện',
    singular: 'danh mục',
    name: 'categoryName',
    id: 'categoryId',
    columns: ['Tên danh mục', 'Số linh kiện'],
  },
  rooms: {
    title: 'Phòng lab',
    singular: 'phòng lab',
    name: 'roomName',
    id: 'roomId',
    columns: ['Mã phòng', 'Tên phòng', 'Trạng thái', 'Số tủ'],
  },
  cabinets: {
    title: 'Tủ lưu trữ',
    singular: 'tủ',
    name: 'cabinetName',
    id: 'cabinetId',
    columns: ['Mã tủ', 'Tên tủ', 'Phòng lab', 'Trạng thái'],
  },
}

const getId = (row, kind) => {
  if (!row) return ''
  if (kind === 'rooms') {
    return row.roomId || row.labRoomId || row.id || row.RoomId || row.LabRoomId || ''
  }
  if (kind === 'cabinets') {
    return row.cabinetId || row.id || row.CabinetId || ''
  }
  if (kind === 'categories') {
    return row.categoryId || row.id || row.CategoryId || ''
  }
  return row[fields[kind]?.id] || row.id || ''
}

const getName = (row, kind) => {
  if (!row) return ''
  if (kind === 'rooms') {
    return row.roomName || row.labRoomName || row.name || row.RoomName || row.LabRoomName || ''
  }
  if (kind === 'cabinets') {
    return row.cabinetName || row.name || row.CabinetName || ''
  }
  if (kind === 'categories') {
    return row.categoryName || row.name || row.CategoryName || row.title || ''
  }
  return row[fields[kind]?.name] || row.name || ''
}

const getActive = (row) => {
  if (!row) return false
  if (row.isActive !== undefined) return Boolean(row.isActive)
  if (row.active !== undefined) return Boolean(row.active)
  if (row.status) return String(row.status).toLowerCase() === 'active'
  return true
}

const sanitizeRows = (items, targetKind) => {
  if (!Array.isArray(items)) return []
  return items.filter((row) => {
    if (!row) return false
    if (targetKind === 'categories') {
      const catName = row.categoryName || row.name || row.CategoryName || row.title
      return Boolean(catName && String(catName).trim().length > 0)
    }
    if (targetKind === 'rooms') {
      const roomName = row.roomName || row.labRoomName || row.name || row.RoomName
      const roomCode = row.labRoomCode || row.roomCode || row.code
      return Boolean(
        (roomName && String(roomName).trim().length > 0) ||
        (roomCode && String(roomCode).trim().length > 0)
      )
    }
    if (targetKind === 'cabinets') {
      const cabName = row.cabinetName || row.name || row.CabinetName
      const cabCode = row.cabinetCode || row.code
      return Boolean(
        (cabName && String(cabName).trim().length > 0) ||
        (cabCode && String(cabCode).trim().length > 0)
      )
    }
    return true
  })
}

export default function InventorySetup() {
  const location = useLocation()
  const navigate = useNavigate()
  const { hasRole, hasPermission } = useAuth()

  // Phân quyền theo vai trò
  const isLabStaff = hasRole('LabStaff') && !hasRole('Admin') && !hasRole('InventoryManager')
  const canManageCategories = hasRole('Admin') || hasRole('InventoryManager') || hasPermission('COMPONENT_MANAGE')
  const canManageStaff = hasRole('Admin') || hasRole('InventoryManager') || hasPermission('USER_MANAGE')

  // Xác định các Tabs hiển thị phù hợp với quyền người dùng
  const tabs = useMemo(() => {
    if (isLabStaff) {
      return [
        ['/class-setup/admin/lab-rooms', 'Phòng lab'],
        ['/class-setup/admin/cabinets', 'Tủ lưu trữ'],
      ]
    }
    return [
      ['/class-setup/admin/categories', 'Danh mục'],
      ['/class-setup/admin/lab-rooms', 'Phòng lab'],
      ['/class-setup/admin/cabinets', 'Tủ lưu trữ'],
    ]
  }, [isLabStaff])

  // Nếu LabStaff cố tình truy cập /categories thì tự động điều hướng sang /lab-rooms
  useEffect(() => {
    if (isLabStaff && location.pathname.endsWith('/categories')) {
      navigate('/class-setup/admin/lab-rooms', { replace: true })
    }
  }, [isLabStaff, location.pathname, navigate])

  const kind = location.pathname.endsWith('/categories')
    ? 'categories'
    : location.pathname.endsWith('/lab-rooms')
      ? 'rooms'
      : 'cabinets'

  const [rows, setRows] = useState([])
  const [rooms, setRooms] = useState([])
  const [roomFilter, setRoomFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // State Modal Phân công Staff cho phòng lab (POST /api/lab-rooms/{id}/staff)
  const [assignStaffOpen, setAssignStaffOpen] = useState(false)
  const [selectedRoomForStaff, setSelectedRoomForStaff] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [assigningStaff, setAssigningStaff] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const request = kind === 'categories'
      ? inventoryService.getCategories().then((items) => ({ rows: sanitizeRows(items, 'categories') }))
      : kind === 'rooms'
        ? inventoryService.getLabRooms().then((items) => ({ rows: sanitizeRows(items, 'rooms') }))
        : Promise.all([
            inventoryService.getCabinets(roomFilter ? { roomId: roomFilter, labRoomId: roomFilter } : undefined),
            inventoryService.getLabRooms(),
          ]).then(([items, labRooms]) => ({
            rows: sanitizeRows(items, 'cabinets'),
            rooms: sanitizeRows(labRooms, 'rooms'),
          }))

    return request
      .then((result) => {
        setRows(result.rows || [])
        if (result.rooms) setRooms(result.rooms)
        setLoading(false)
      })
      .catch((loadError) => {
        setError(extractErrorMessage(loadError, `Không thể tải dữ liệu ${fields[kind].title.toLowerCase()}.`))
        setLoading(false)
      })
  }, [kind, roomFilter])

  // Reset state và tải dữ liệu mới khi chuyển tab hoặc đổi bộ lọc
  useEffect(() => {
    let isSubscribed = true

    const executeFetch = async () => {
      setRows([])
      setError('')
      setNotice('')
      setLoading(true)

      // Nếu không có quyền truy cập categories thì không gọi API
      if (kind === 'categories' && !canManageCategories) {
        if (isSubscribed) {
          setLoading(false)
        }
        return
      }

      try {
        const result = kind === 'categories'
          ? await inventoryService.getCategories().then((items) => ({ rows: sanitizeRows(items, 'categories') }))
          : kind === 'rooms'
            ? await inventoryService.getLabRooms().then((items) => ({ rows: sanitizeRows(items, 'rooms') }))
            : await Promise.all([
                inventoryService.getCabinets(roomFilter ? { roomId: roomFilter, labRoomId: roomFilter } : undefined),
                inventoryService.getLabRooms(),
              ]).then(([items, labRooms]) => ({
                rows: sanitizeRows(items, 'cabinets'),
                rooms: sanitizeRows(labRooms, 'rooms'),
              }))

        if (isSubscribed) {
          setRows(result.rows || [])
          if (result.rooms) setRooms(result.rooms)
          setLoading(false)
        }
      } catch (loadError) {
        if (isSubscribed) {
          setError(extractErrorMessage(loadError, `Không thể tải dữ liệu ${fields[kind].title.toLowerCase()}.`))
          setRows([])
          setLoading(false)
        }
      }
    }

    executeFetch()

    return () => {
      isSubscribed = false
    }
  }, [kind, roomFilter, canManageCategories])

  const tabIndex = Math.max(tabs.findIndex(([path]) => path === location.pathname), 0)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setSelectedRoom('')
    setActive(true)
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setName(getName(row, kind))
    setSelectedRoom(row.roomId || row.labRoomId || '')
    setActive(getActive(row))
    setError('')
    setDialogOpen(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setError('')

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(`Vui lòng nhập tên ${fields[kind].singular}.`)
      return
    }

    if (kind === 'cabinets' && !selectedRoom) {
      setError('Vui lòng chọn phòng lab chứa tủ.')
      return
    }

    const id = editing && getId(editing, kind)

    try {
      const body = kind === 'categories'
        ? { categoryName: trimmedName }
        : kind === 'rooms'
          ? {
              roomName: trimmedName,
              status: active ? 'Active' : 'Inactive',
              isActive: active,
            }
          : {
              cabinetName: trimmedName,
              roomId: selectedRoom,
              labRoomId: selectedRoom,
              status: active ? 'Active' : 'Inactive',
              isActive: active,
            }
      if (editing) {
        if (kind === 'categories') await inventoryService.updateCategory(id, body)
        else if (kind === 'rooms') await inventoryService.updateLabRoom(id, body)
        else await inventoryService.updateCabinet(id, body)
      } else if (kind === 'categories') await inventoryService.createCategory(body)
      else if (kind === 'rooms') await inventoryService.createLabRoom(body)
      else await inventoryService.createCabinet(body)
      setDialogOpen(false)
      setNotice(editing ? 'Đã cập nhật thành công.' : `Đã tạo ${fields[kind].singular} thành công.`)
      await load()
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu dữ liệu.'))
    }
  }

  const handleDelete = async (row) => {
    const itemName = getName(row, kind)
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${fields[kind].singular} "${itemName}"?`)) return
    try {
      await inventoryService.deleteCategory(getId(row, kind))
      setNotice(`Đã xóa danh mục "${itemName}".`)
      await load()
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa. Hãy kiểm tra xem danh mục có linh kiện trực thuộc không.'))
    }
  }

  const openAssignStaff = async (room) => {
    setSelectedRoomForStaff(room)
    setSelectedStaffId('')
    setAssignStaffOpen(true)
    try {
      const data = await userService.getUsers({ role: 'LabStaff', size: 50 })
      setStaffList(data?.items || [])
    } catch {
      // fallback
    }
  }

  const handleAssignStaffSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRoomForStaff || !selectedStaffId) return
    const roomId = getId(selectedRoomForStaff, 'rooms')
    setAssigningStaff(true)
    setError('')
    try {
      await inventoryService.assignLabStaff(roomId, { userId: selectedStaffId, staffUserId: selectedStaffId })
      setNotice(`Đã phân công nhân viên cho phòng ${getName(selectedRoomForStaff, 'rooms')}!`)
      setAssignStaffOpen(false)
      await load()
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể phân công nhân viên.'))
    } finally {
      setAssigningStaff(false)
    }
  }

  return (
    <PortalLayout headerTitle="Thiết lập kho" headerSubtitle="Quản lý danh mục linh kiện, phòng lab và tủ lưu trữ">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Tabs value={tabIndex} onChange={(_, index) => navigate(tabs[index][0])} sx={{ mb: 2 }}>
          {tabs.map(([, label]) => <Tab key={label} label={label} sx={{ fontWeight: 700 }} />)}
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: '6px 6px 0 0' }}>
          <Typography sx={{ fontWeight: 800, color: '#182238', fontSize: 16 }}>{fields[kind].title}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {kind === 'cabinets' && (
              <TextField
                select
                size="small"
                label="Lọc phòng lab"
                value={roomFilter}
                onChange={(event) => setRoomFilter(event.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Tất cả phòng lab</MenuItem>
                {rooms.map((room) => (
                  <MenuItem key={getId(room, 'rooms')} value={getId(room, 'rooms')}>
                    {room.roomName || room.labRoomCode || room.roomCode}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={openCreate}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
            >
              Thêm mới
            </Button>
          </Box>
        </Box>

        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderTop: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9ff' }}>
                {fields[kind].columns.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 700, color: '#334155' }}>
                    {column}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={fields[kind].columns.length + 1} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} sx={{ mr: 1, verticalAlign: 'middle' }} />
                    <Typography variant="body2" component="span" sx={{ color: 'text.secondary' }}>
                      Đang tải danh sách {fields[kind].title.toLowerCase()}...
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading && rows.map((row) => {
                const id = getId(row, kind)
                const isActive = getActive(row)
                return (
                  <TableRow key={id} hover>
                    {kind === 'categories' && (
                      <>
                        <TableCell sx={{ fontWeight: 600 }}>{getName(row, kind) || '—'}</TableCell>
                        <TableCell>{row.componentCount ?? row.componentsCount ?? 0}</TableCell>
                      </>
                    )}
                    {kind === 'rooms' && (
                      <>
                        <TableCell sx={{ fontWeight: 600, color: '#0058be' }}>
                          {row.labRoomCode || row.roomCode || '—'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{getName(row, kind) || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                            color={isActive ? 'success' : 'default'}
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: 11 }}
                          />
                        </TableCell>
                        <TableCell>{row.cabinetCount ?? row.activeCabinetCount ?? row.cabinetsCount ?? 0}</TableCell>
                      </>
                    )}
                    {kind === 'cabinets' && (
                      <>
                        <TableCell sx={{ fontWeight: 600, color: '#0058be' }}>
                          {row.cabinetCode || '—'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{getName(row, kind) || '—'}</TableCell>
                        <TableCell>
                          {row.labRoomName ||
                            row.roomName ||
                            rooms.find((room) => getId(room, 'rooms') === (row.roomId || row.labRoomId))?.roomName ||
                            '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                            color={isActive ? 'success' : 'default'}
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: 11 }}
                          />
                        </TableCell>
                      </>
                    )}
                    <TableCell align="right">
                      {kind === 'cabinets' && (
                        <Button
                          size="small"
                          onClick={() => navigate(`/class-setup/admin/cabinets/${id}`)}
                          sx={{ textTransform: 'none', mr: 0.5, fontWeight: 600 }}
                        >
                          Chi tiết
                        </Button>
                      )}
                      {kind === 'rooms' && canManageStaff && (
                        <Button
                          size="small"
                          startIcon={<StaffAddIcon fontSize="small" />}
                          onClick={() => openAssignStaff(row)}
                          sx={{ textTransform: 'none', mr: 0.5, fontWeight: 600 }}
                        >
                          Phân công
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={() => openEdit(row)}
                        sx={{ textTransform: 'none', mr: 0.5, fontWeight: 600 }}
                      >
                        Sửa
                      </Button>
                      {kind === 'categories' && canManageCategories && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDelete(row)}
                          title="Xóa danh mục"
                        >
                          <DeleteIcon fontSize="small" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={fields[kind].columns.length + 1} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    Chưa có dữ liệu {fields[kind].singular}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Modal Thêm / Cập nhật Danh mục, Phòng Lab, Tủ */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
          <Box component="form" onSubmit={handleSave}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              {editing ? `Cập nhật ${fields[kind].singular}` : `Thêm ${fields[kind].singular} mới`}
            </DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                required
                autoFocus
                label={kind === 'rooms' ? 'Tên phòng lab' : kind === 'cabinets' ? 'Tên tủ' : 'Tên danh mục'}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {kind === 'cabinets' && (
                <TextField
                  required
                  select
                  label="Phòng lab chứa tủ"
                  value={selectedRoom}
                  onChange={(event) => setSelectedRoom(event.target.value)}
                >
                  {rooms
                    .filter((room) => getActive(room) || getId(room, 'rooms') === selectedRoom)
                    .map((room) => {
                      const rId = getId(room, 'rooms')
                      return (
                        <MenuItem key={rId} value={rId}>
                          {room.roomName || room.labRoomCode || room.roomCode}
                        </MenuItem>
                      )
                    })}
                </TextField>
              )}
              {kind !== 'categories' && (
                <TextField
                  select
                  label="Trạng thái"
                  value={active ? 'true' : 'false'}
                  onChange={(event) => setActive(event.target.value === 'true')}
                >
                  <MenuItem value="true">Đang hoạt động</MenuItem>
                  <MenuItem value="false">Ngừng hoạt động</MenuItem>
                </TextField>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>
                Hủy
              </Button>
              <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}>
                {editing ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        {/* Modal Phân công Staff cho phòng lab (POST /api/lab-rooms/{id}/staff) */}
        <Dialog open={assignStaffOpen} onClose={() => !assigningStaff && setAssignStaffOpen(false)} fullWidth maxWidth="xs">
          <Box component="form" onSubmit={handleAssignStaffSubmit}>
            <DialogTitle sx={{ fontWeight: 800 }}>Phân công cán bộ phụ trách</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
              <Typography variant="body2" sx={{ color: '#6b7280' }}>
                Phòng lab: <strong>{getName(selectedRoomForStaff, 'rooms')}</strong> ({selectedRoomForStaff?.labRoomCode || ''})
              </Typography>
              <TextField
                select
                required
                size="small"
                label="Chọn Cán bộ Lab (LabStaff)"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                {staffList.map((staff) => (
                  <MenuItem key={staff.userId || staff.id} value={staff.userId || staff.id}>
                    {staff.fullName || staff.username} ({staff.email || staff.username})
                  </MenuItem>
                ))}
                {staffList.length === 0 && (
                  <MenuItem value="labstaff01">labstaff01 - Nhân viên Lab 01</MenuItem>
                )}
              </TextField>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setAssignStaffOpen(false)} disabled={assigningStaff} sx={{ textTransform: 'none' }}>
                Hủy
              </Button>
              <Button type="submit" variant="contained" disabled={assigningStaff} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}>
                {assigningStaff ? 'Đang lưu...' : 'Lưu phân công'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>
    </PortalLayout>
  )
}
