import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, PersonAdd as StaffAddIcon } from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { inventoryService } from '../../services/inventoryService'
import { userService } from '../../services/userService'
import { extractErrorMessage } from '../../services/api'

const fields = {
  categories: { title: 'Danh mục', singular: 'danh mục', name: 'categoryName', id: 'categoryId', columns: ['Tên danh mục', 'Số linh kiện'] },
  rooms: { title: 'Phòng lab', singular: 'phòng lab', name: 'roomName', id: 'roomId', columns: ['Mã phòng', 'Tên phòng', 'Trạng thái', 'Số tủ'] },
  cabinets: { title: 'Tủ lưu trữ', singular: 'tủ', name: 'cabinetName', id: 'cabinetId', columns: ['Mã tủ', 'Tên tủ', 'Phòng lab', 'Trạng thái'] },
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
    return row.roomName || row.name || row.RoomName || ''
  }
  if (kind === 'cabinets') {
    return row.cabinetName || row.name || row.CabinetName || ''
  }
  if (kind === 'categories') {
    return row.categoryName || row.name || row.CategoryName || ''
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

export default function InventorySetup() {
  const location = useLocation()
  const navigate = useNavigate()
  const kind = location.pathname.endsWith('/categories') ? 'categories'
    : location.pathname.endsWith('/lab-rooms') ? 'rooms' : 'cabinets'
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
    const request = kind === 'categories'
      ? inventoryService.getCategories().then((items) => ({ rows: items }))
      : kind === 'rooms'
        ? inventoryService.getLabRooms().then((items) => ({ rows: items }))
        : Promise.all([
            inventoryService.getCabinets(roomFilter ? { roomId: roomFilter, labRoomId: roomFilter } : undefined),
            inventoryService.getLabRooms(),
          ]).then(([items, labRooms]) => ({ rows: items, rooms: labRooms }))
    return request.then((result) => {
      setRows(result.rows)
      if (result.rooms) setRooms(result.rooms)
      setLoading(false)
    }).catch((loadError) => {
      setError(extractErrorMessage(loadError, `Không thể tải ${fields[kind].title.toLowerCase()}.`))
      setLoading(false)
    })
  }, [kind, roomFilter])

  useEffect(() => {
    let active = true
    const request = kind === 'categories'
      ? inventoryService.getCategories().then((items) => ({ rows: items }))
      : kind === 'rooms'
        ? inventoryService.getLabRooms().then((items) => ({ rows: items }))
        : Promise.all([
            inventoryService.getCabinets(roomFilter ? { roomId: roomFilter, labRoomId: roomFilter } : undefined),
            inventoryService.getLabRooms(),
          ]).then(([items, labRooms]) => ({ rows: items, rooms: labRooms }))
    request.then((result) => {
      if (!active) return
      setRows(result.rows)
      if (result.rooms) setRooms(result.rooms)
      setLoading(false)
    }).catch((loadError) => {
      if (!active) return
      setError(extractErrorMessage(loadError, `Không thể tải ${fields[kind].title.toLowerCase()}.`))
      setLoading(false)
    })
    return () => { active = false }
  }, [kind, roomFilter])

  const tabs = useMemo(() => [
    ['/class-setup/admin/categories', 'Danh mục'],
    ['/class-setup/admin/lab-rooms', 'Phòng lab'],
    ['/class-setup/admin/cabinets', 'Tủ'],
  ], [])
  const tabValue = tabs.findIndex(([path]) => path === location.pathname)

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
    const id = editing && getId(editing, kind)
    try {
      const body = kind === 'categories'
        ? { categoryName: name.trim() }
        : kind === 'rooms'
          ? {
              roomName: name.trim(),
              status: active ? 'Active' : 'Inactive',
              isActive: active,
            }
          : {
              cabinetName: name.trim(),
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
    if (!window.confirm(`Xóa ${fields[kind].singular} "${getName(row, kind)}"?`)) return
    try {
      await inventoryService.deleteCategory(getId(row, kind))
      setNotice('Đã xóa danh mục.')
      await load()
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa. Hãy kiểm tra dữ liệu đang tham chiếu.'))
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
        <Tabs value={Math.max(tabValue, 0)} onChange={(_, index) => navigate(tabs[index][0])} sx={{ mb: 2 }}>
          {tabs.map(([, label]) => <Tab key={label} label={label} />)}
        </Tabs>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: '6px 6px 0 0' }}>
          <Typography sx={{ fontWeight: 800, color: '#182238' }}>{fields[kind].title}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {kind === 'cabinets' && (
              <TextField select size="small" label="Lọc phòng lab" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} sx={{ minWidth: 180 }}>
                <MenuItem value="">Tất cả phòng</MenuItem>
                {rooms.map((room) => <MenuItem key={getId(room, 'rooms')} value={getId(room, 'rooms')}>{room.roomName || room.labRoomCode || room.roomCode}</MenuItem>)}
              </TextField>
            )}
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate} sx={{ textTransform: 'none' }}>Thêm mới</Button>
          </Box>
        </Box>
        <TableContainer sx={{ bgcolor: '#fff', border: '1px solid #d8dced', borderTop: 0 }}>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor: '#faf9ff' }}>{fields[kind].columns.map((column) => <TableCell key={column}>{column}</TableCell>)}<TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
            <TableBody>
              {rows.map((row) => {
                const id = getId(row, kind)
                const isActive = getActive(row)
                return (
                  <TableRow key={id} hover>
                    {kind === 'categories' && <>
                      <TableCell>{getName(row, kind)}</TableCell>
                      <TableCell>{row.componentCount ?? row.componentsCount ?? 0}</TableCell>
                    </>}
                    {kind === 'rooms' && <>
                      <TableCell>{row.labRoomCode || row.roomCode || 'Tự sinh khi tạo'}</TableCell>
                      <TableCell>{getName(row, kind)}</TableCell>
                      <TableCell><Chip size="small" label={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} color={isActive ? 'success' : 'default'} /></TableCell>
                      <TableCell>{row.cabinetCount ?? row.activeCabinetCount ?? 0}</TableCell>
                    </>}
                    {kind === 'cabinets' && <>
                      <TableCell>{row.cabinetCode || 'Tự sinh khi tạo'}</TableCell>
                      <TableCell>{getName(row, kind)}</TableCell>
                      <TableCell>{row.labRoomName || row.roomName || rooms.find((room) => getId(room, 'rooms') === (row.roomId || row.labRoomId))?.roomName || '—'}</TableCell>
                      <TableCell><Chip size="small" label={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} color={isActive ? 'success' : 'default'} /></TableCell>
                    </>}
                    <TableCell align="right">
                      {kind === 'cabinets' && (
                        <Button size="small" onClick={() => navigate(`/class-setup/admin/cabinets/${id}`)} sx={{ textTransform: 'none' }}>Chi tiết</Button>
                      )}
                      {kind === 'rooms' && (
                        <Button size="small" startIcon={<StaffAddIcon fontSize="small" />} onClick={() => openAssignStaff(row)} sx={{ textTransform: 'none', mr: 1 }}>Phân công</Button>
                      )}
                      <Button size="small" onClick={() => openEdit(row)} sx={{ textTransform: 'none' }}>Sửa</Button>
                      {kind === 'categories' && <Button size="small" color="error" onClick={() => handleDelete(row)}><DeleteIcon fontSize="small" /></Button>}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={fields[kind].columns.length + 1} align="center">Chưa có dữ liệu.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
          <Box component="form" onSubmit={handleSave}>
            <DialogTitle>{editing ? `Cập nhật ${fields[kind].singular}` : `Thêm ${fields[kind].singular}`}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField required autoFocus label={kind === 'rooms' ? 'Tên phòng lab' : kind === 'cabinets' ? 'Tên tủ' : 'Tên danh mục'} value={name} onChange={(event) => setName(event.target.value)} />
              {kind === 'cabinets' && (
                <TextField
                  required
                  select
                  label="Phòng lab"
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
              {kind !== 'categories' && <TextField select label="Trạng thái" value={active ? 'true' : 'false'} onChange={(event) => setActive(event.target.value === 'true')}>
                <MenuItem value="true">Đang hoạt động</MenuItem><MenuItem value="false">Ngừng hoạt động</MenuItem>
              </TextField>}
            </DialogContent>
            <DialogActions><Button onClick={() => setDialogOpen(false)}>Hủy</Button><Button type="submit" variant="contained">Lưu</Button></DialogActions>
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
              <Button type="submit" variant="contained" disabled={assigningStaff} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {assigningStaff ? 'Đang lưu...' : 'Lưu phân công'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>
    </PortalLayout>
  )
}
