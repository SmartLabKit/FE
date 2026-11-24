import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, PersonAdd as StaffAddIcon } from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import TrackingTypeBadge from '../../components/common/TrackingTypeBadge'
import { inventoryService } from '../../services/inventoryService'
import { userService } from '../../services/userService'
import { extractErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const CABINET_TYPES = [
  ['CONSUMABLE', 'Tiêu hao (vật tư đếm số lượng)'],
  ['REUSABLE', 'Tái sử dụng (từng thiết bị có mã)'],
  ['HIGH_VALUE', 'Giá trị cao (có serial)'],
]

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
    columns: ['Mã tủ', 'Tên tủ', 'Loại tủ', 'Phòng lab', 'Trạng thái'],
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
  const canManageStaff = hasRole('Admin') || hasPermission('USER_MANAGE')
  const canManageStorage = hasRole('Admin') || hasRole('InventoryManager') || hasPermission('COMPONENT_MANAGE')
  const canEditInventory = canManageStorage

  // Xác định các Tabs hiển thị phù hợp với quyền người dùng
  const tabs = useMemo(() => {
    if (isLabStaff || !canManageStorage) {
      return [['/class-setup/admin/cabinets', 'Tủ lưu trữ']]
    }
    return [
      ['/class-setup/admin/categories', 'Danh mục'],
      ['/class-setup/admin/lab-rooms', 'Phòng lab'],
      ['/class-setup/admin/cabinets', 'Tủ lưu trữ'],
    ]
  }, [canManageStorage, isLabStaff])

  // Người không có quyền quản lý rời khỏi mục danh mục.
  useEffect(() => {
    if ((isLabStaff || !canManageStorage) && location.pathname.endsWith('/categories')) {
      navigate('/class-setup/admin/cabinets', { replace: true })
    }
  }, [canManageStorage, isLabStaff, location.pathname, navigate])

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
  const [trackingType, setTrackingType] = useState('')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // State Modal Phân công Staff cho phòng lab (POST /api/lab-rooms/{id}/staff)
  const [assignStaffOpen, setAssignStaffOpen] = useState(false)
  const [selectedRoomForStaff, setSelectedRoomForStaff] = useState(null)
  const [confirmRequest, setConfirmRequest] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [assignedStaff, setAssignedStaff] = useState([])
  const [staffAssignedElsewhere, setStaffAssignedElsewhere] = useState({})
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [assigningStaff, setAssigningStaff] = useState(false)

  // State Modal Xác nhận xóa danh mục
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (isSubscribed = () => true, resetView = false) => {
    setLoading(true)
    setError('')
    if (resetView) {
      setRows([])
      setNotice('')
    }
    try {
      let result
      if (kind === 'categories') {
        if (!canManageCategories) {
          setRows([])
          setLoading(false)
          return
        }
        result = { rows: sanitizeRows(await inventoryService.getCategories(), 'categories') }
      } else if (kind === 'rooms') {
        result = { rows: sanitizeRows(await inventoryService.getLabRooms(), 'rooms') }
      } else {
        const allRooms = sanitizeRows(await inventoryService.getLabRooms(), 'rooms')
        const visibleRooms = isLabStaff ? allRooms.filter((room) => room.isMine) : allRooms
        const visibleRoomIds = new Set(visibleRooms.map((room) => String(getId(room, 'rooms'))))
        const cabinets = await inventoryService.getCabinets(
          roomFilter ? { roomId: roomFilter, labRoomId: roomFilter } : undefined
        )
        result = {
          rows: sanitizeRows(cabinets, 'cabinets').filter(
            (cabinet) => !isLabStaff || visibleRoomIds.has(String(cabinet.roomId || cabinet.labRoomId))
          ),
          rooms: visibleRooms,
        }
      }

      if (isSubscribed()) {
        setRows(result.rows || [])
        setRooms(result.rooms || [])
        setLoading(false)
      }
    } catch (loadError) {
      if (isSubscribed()) {
        setError(extractErrorMessage(loadError, `Không thể tải dữ liệu ${fields[kind].title.toLowerCase()}.`))
        setRows([])
        setRooms([])
        setLoading(false)
      }
    }
  }, [canManageCategories, isLabStaff, kind, roomFilter])

  // Reset state và tải dữ liệu mới khi chuyển tab hoặc đổi bộ lọc
  useEffect(() => {
    let isSubscribed = true

    Promise.resolve().then(() => load(() => isSubscribed, true))

    return () => {
      isSubscribed = false
    }
  }, [canManageCategories, kind, load])

  const tabIndex = Math.max(tabs.findIndex(([path]) => path === location.pathname), 0)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setSelectedRoom('')
    setTrackingType('')
    setActive(true)
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setName(getName(row, kind))
    setSelectedRoom(row.roomId || row.labRoomId || '')
    setTrackingType(row.trackingType || '')
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

    if (kind === 'cabinets' && !editing && !trackingType) {
      setError('Vui lòng chọn loại tủ.')
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
              trackingType: trackingType || null,
              location: editing?.location ?? null,
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

  const handleDeleteClick = (row) => {
    setCategoryToDelete(row)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return
    const itemName = getName(categoryToDelete, kind)
    const id = getId(categoryToDelete, kind)
    setDeleting(true)
    setError('')
    try {
      await inventoryService.deleteCategory(id)
      setNotice(`Đã xóa danh mục “${itemName}”.`)
      setDeleteConfirmOpen(false)
      setCategoryToDelete(null)
      await load()
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, 'Không thể xóa. Hãy kiểm tra xem danh mục có linh kiện trực thuộc không.'))
      setDeleteConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const openAssignStaff = async (room) => {
    setSelectedRoomForStaff(room)
    setSelectedStaffId('')
    setError('')
    setAssignStaffOpen(true)
    const roomId = getId(room, 'rooms')
    try {
      const [data, roomStaffLists] = await Promise.all([
        userService.getUsers({ role: 'LabStaff', isActive: true, size: 100 }),
        Promise.all(rows.map(async (listedRoom) => ({
          room: listedRoom,
          staff: await inventoryService.getLabStaff(getId(listedRoom, 'rooms')),
        }))),
      ])
      const currentStaff = roomStaffLists.find(
        ({ room: listedRoom }) => String(getId(listedRoom, 'rooms')) === String(roomId)
      )?.staff || []
      const alreadyAssigned = {}
      roomStaffLists.forEach(({ room: listedRoom, staff }) => {
        if (String(getId(listedRoom, 'rooms')) === String(roomId)) return
        staff.forEach((member) => {
          const staffUserId = member.userId || member.staffUserId || member.user?.userId || member.user?.id || member.id
          if (staffUserId) alreadyAssigned[String(staffUserId)] = getName(listedRoom, 'rooms')
        })
      })
      setStaffList(data?.items || data?.users || [])
      setAssignedStaff(currentStaff)
      setStaffAssignedElsewhere(alreadyAssigned)
    } catch (loadError) {
      setError(extractErrorMessage(loadError, 'Không thể tải dữ liệu phân công nhân viên.'))
      setStaffList([])
      setAssignedStaff([])
      setStaffAssignedElsewhere({})
    }
  }

  const confirmRemoveStaff = (staff) =>
    setConfirmRequest({
      title: 'Gỡ nhân viên khỏi lab?',
      message: `${staff.fullName || staff.username || staff.name} sẽ không còn giao, nhận trả, ghi nhận sự cố và kiểm kê ở lab này.`,
      confirmText: 'Gỡ',
      onConfirm: () => handleRemoveStaff(staff.userId || staff.id),
    })

  const handleRemoveStaff = async (staffUserId) => {
    if (!selectedRoomForStaff) return
    const roomId = getId(selectedRoomForStaff, 'rooms')
    try {
      await inventoryService.removeLabStaff(roomId, staffUserId)
      setNotice('Đã gỡ nhân viên khỏi phòng.')
      const currentStaff = await inventoryService.getLabStaff(roomId)
      setAssignedStaff(Array.isArray(currentStaff) ? currentStaff : [])
      await load()
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể gỡ nhân viên.'))
    }
  }

  const handleAssignStaffSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRoomForStaff || !selectedStaffId) return
    const roomId = getId(selectedRoomForStaff, 'rooms')
    setAssigningStaff(true)
    setError('')
    try {
      const roomStaffLists = await Promise.all(rows.map(async (room) => ({
        room,
        staff: await inventoryService.getLabStaff(getId(room, 'rooms')),
      })))
      const conflictingRoom = roomStaffLists.find(({ staff }) =>
        staff.some((member) => {
          const assignedUserId = member.userId || member.staffUserId || member.user?.userId || member.user?.id || member.id
          return assignedUserId != null && String(assignedUserId) === String(selectedStaffId)
        })
      )?.room
      if (conflictingRoom) {
        const alreadyInThisRoom = String(getId(conflictingRoom, 'rooms')) === String(roomId)
        setError(alreadyInThisRoom
          ? 'Nhân viên này đã được phân công cho phòng hiện tại.'
          : `${getName(conflictingRoom, 'rooms')} đã có nhân viên này. Mỗi nhân viên chỉ được phụ trách một phòng.`)
        return
      }

      await inventoryService.assignLabStaff(roomId, { userId: selectedStaffId })
      setNotice(`Đã phân công nhân viên cho phòng ${getName(selectedRoomForStaff, 'rooms')}!`)
      const currentStaff = await inventoryService.getLabStaff(roomId)
      setAssignedStaff(Array.isArray(currentStaff) ? currentStaff : [])
      setSelectedStaffId('')
      await load()
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể phân công nhân viên.'))
    } finally {
      setAssigningStaff(false)
    }
  }

  return (
    <PortalLayout
      headerTitle="Tủ lưu trữ"
      headerSubtitle="Quản lý tủ lưu trữ được phân công"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {tabs.length > 1 && (
          <Tabs value={tabIndex} onChange={(_, index) => navigate(tabs[index][0])} sx={{ mb: 2 }}>
            {tabs.map(([, label]) => <Tab key={label} label={label} sx={{ fontWeight: 700 }} />)}
          </Tabs>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', border: '1px solid #d8dced', borderRadius: '6px 6px 0 0' }}>
          <Typography sx={{ fontWeight: 800, color: '#182238', fontSize: 16 }}>{fields[kind].title}</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {kind === 'cabinets' && isLabStaff && rooms.length === 1 && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`Phụ trách: ${getName(rooms[0], 'rooms')}`}
              />
            )}
            {kind === 'cabinets' && !isLabStaff && (
              <TextField
                select
                size="small"
                label="Lọc phòng lab"
                value={roomFilter}
                onChange={(event) => setRoomFilter(event.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">{isLabStaff ? 'Tất cả phòng được phân công' : 'Tất cả phòng lab'}</MenuItem>
                {rooms.map((room) => (
                  <MenuItem key={getId(room, 'rooms')} value={getId(room, 'rooms')}>
                    {getName(room, 'rooms') || room.labRoomCode || room.roomCode}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {canEditInventory && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={openCreate}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
              >
                Thêm
              </Button>
            )}
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
                {(canEditInventory || (kind === 'cabinets' && hasPermission('COMPONENT_VIEW'))) && (
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>
                    Thao tác
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={fields[kind].columns.length + ((canEditInventory || (kind === 'cabinets' && hasPermission('COMPONENT_VIEW'))) ? 1 : 0)} align="center" sx={{ py: 4 }}>
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
                          {row.trackingType ? <TrackingTypeBadge type={row.trackingType} /> : 'Chưa gắn loại'}
                        </TableCell>
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
                    {(canEditInventory || (kind === 'cabinets' && hasPermission('COMPONENT_VIEW'))) && (
                      <TableCell align="right">
                        {kind === 'cabinets' && (canEditInventory || hasPermission('COMPONENT_VIEW')) && (
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
                        {canEditInventory && (
                          <Button
                            size="small"
                            onClick={() => openEdit(row)}
                            sx={{ textTransform: 'none', mr: 0.5, fontWeight: 600 }}
                          >
                            Sửa
                          </Button>
                        )}
                        {kind === 'categories' && canManageCategories && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(row)}
                            title="Xóa danh mục"
                          >
                            <DeleteIcon fontSize="small" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}

              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={fields[kind].columns.length + ((canEditInventory || (kind === 'cabinets' && hasPermission('COMPONENT_VIEW'))) ? 1 : 0)} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    {isLabStaff && kind === 'cabinets' && rooms.length === 0
                      ? !error && (
                        <Box sx={{ maxWidth: 620, mx: 'auto', p: 3, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <Typography sx={{ fontWeight: 700, color: '#334155' }}>
                            Tài khoản của bạn chưa được phân công phụ trách phòng lab nào. Vui lòng liên hệ Quản trị viên để được bổ sung.
                          </Typography>
                        </Box>
                      )
                      : `Chưa có dữ liệu ${fields[kind].singular}.`}
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
              {kind === 'cabinets' && (
                <TextField
                  required={!editing}
                  select
                  label="Loại tủ"
                  value={trackingType}
                  onChange={(event) => setTrackingType(event.target.value)}
                  helperText="Phiếu nhập tự chọn tủ cùng loại với linh kiện"
                >
                  {editing && !editing.trackingType && <MenuItem value="">Chưa gắn loại</MenuItem>}
                  {CABINET_TYPES.map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
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

        {/* Modal Phân công Staff cho phòng lab (POST /api/lab-rooms/{id}/staff & GET/DELETE) */}
        <Dialog open={assignStaffOpen} onClose={() => !assigningStaff && setAssignStaffOpen(false)} fullWidth maxWidth="sm">
          <Box component="form" onSubmit={handleAssignStaffSubmit}>
            <DialogTitle sx={{ fontWeight: 800 }}>Phân công cán bộ phụ trách phòng Lab</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography variant="body2" sx={{ color: '#6b7280' }}>
                Phòng lab: <strong>{getName(selectedRoomForStaff, 'rooms')}</strong> ({selectedRoomForStaff?.labRoomCode || ''})
              </Typography>

              {/* Danh sách cán bộ hiện đang phụ trách (GET /api/lab-rooms/{id}/staff) */}
              <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 1 }}>
                  Cán bộ hiện đang phụ trách ({assignedStaff.length}):
                </Typography>
                {assignedStaff.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                    Chưa có cán bộ nào được gán cho phòng này.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {assignedStaff.map((staff) => (
                      <Box
                        key={staff.userId || staff.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1,
                          bgcolor: '#fff',
                          borderRadius: 1,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {staff.fullName || staff.username || staff.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {staff.email || staff.username}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => confirmRemoveStaff(staff)}
                          sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, py: 0.2 }}
                        >
                          Gỡ
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <TextField
                select
                size="small"
                label="Chọn thêm Cán bộ Lab (LabStaff)"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                helperText="Chọn nhân viên để phân công phụ trách phòng lab này"
              >
                {staffList.map((staff) => (
                  <MenuItem
                    key={staff.userId || staff.id}
                    value={staff.userId || staff.id}
                    disabled={Boolean(staffAssignedElsewhere[String(staff.userId || staff.id)]) ||
                      assignedStaff.some((member) => String(member.userId || member.staffUserId || member.user?.userId || member.user?.id || member.id) === String(staff.userId || staff.id))}
                  >
                    {staff.fullName || staff.username} ({staff.email || staff.username})
                    {staffAssignedElsewhere[String(staff.userId || staff.id)] ? ` — đã phân công: ${staffAssignedElsewhere[String(staff.userId || staff.id)]}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setAssignStaffOpen(false)} disabled={assigningStaff} sx={{ textTransform: 'none' }}>
                Đóng
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={assigningStaff || !selectedStaffId}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be' }}
              >
                {assigningStaff ? 'Đang lưu...' : 'Thêm phân công'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        {/* Modal Xác nhận xóa danh mục */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => !deleting && setDeleteConfirmOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 2, p: 0.5 },
          }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#182238', pb: 1, fontSize: 18 }}>
            Xác nhận xóa danh mục
          </DialogTitle>
          <DialogContent sx={{ pt: '4px !important', pb: 2 }}>
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.6 }}>
              Bạn có chắc chắn muốn xóa danh mục “<strong>{categoryToDelete ? getName(categoryToDelete, kind) : ''}</strong>”? Hành động này không thể hoàn tác.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#d8dced', color: '#475569' }}
            >
              Hủy
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDelete}
              disabled={deleting}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </PortalLayout>
  )
}
