import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../services/api'
import { inventoryService } from '../../services/inventoryService'
import { userService } from '../../services/userService'

const getRoomId = (room) => room?.roomId || room?.labRoomId || room?.id || room?.RoomId || room?.LabRoomId || ''
const getRoomName = (room) => room?.roomName || room?.labRoomName || room?.name || room?.RoomName || ''
const getRoomCode = (room) => room?.roomCode || room?.labRoomCode || room?.code || ''
const getStaffId = (staff) => staff?.userId || staff?.staffUserId || staff?.user?.userId || staff?.user?.id || staff?.id || ''
const getStaffName = (staff) => staff?.fullName || staff?.user?.fullName || staff?.name || staff?.username || 'Nhân viên Lab'
const getStaffUsername = (staff) => staff?.username || staff?.user?.username || staff?.email || staff?.user?.email || ''
const getList = (value, keys = []) => {
  if (Array.isArray(value)) return value
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  return []
}
const getAllActiveLabStaff = async () => {
  const pageSize = 100
  const firstPage = await userService.getUsers({ role: 'LabStaff', isActive: true, page: 1, size: pageSize })
  const firstUsers = getList(firstPage, ['items', 'users'])
  const totalCount = Number(firstPage?.totalCount ?? firstPage?.totalItems ?? firstUsers.length)
  const pageCount = Number(
    firstPage?.totalPages ??
    firstPage?.pageCount ??
    Math.ceil(totalCount / (Number(firstPage?.pageSize ?? firstPage?.size ?? firstUsers.length) || pageSize))
  )
  if (pageCount <= 1) return firstUsers

  const remaining = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      userService.getUsers({ role: 'LabStaff', isActive: true, page: index + 2, size: pageSize })
        .then((page) => getList(page, ['items', 'users']))
    )
  )
  return firstUsers.concat(...remaining)
}
const isRoomActive = (room) => {
  if (room?.isActive !== undefined) return Boolean(room.isActive)
  if (room?.active !== undefined) return Boolean(room.active)
  return String(room?.status || 'Active').toLowerCase() === 'active'
}

export default function LabRoomManagement() {
  const { hasRole, hasPermission } = useAuth()
  const canManageRooms = hasRole('Admin') || hasPermission('COMPONENT_MANAGE') || hasPermission('USER_MANAGE')
  const canEditRooms = hasRole('Admin') || hasPermission('COMPONENT_MANAGE')
  const canManageStaff = hasRole('Admin') || hasPermission('USER_MANAGE')

  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomName, setRoomName] = useState('')
  const [roomActive, setRoomActive] = useState(true)
  const [savingRoom, setSavingRoom] = useState(false)

  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [assignmentRoom, setAssignmentRoom] = useState(null)
  const [assignedStaff, setAssignedStaff] = useState([])
  const [staffOptions, setStaffOptions] = useState([])
  const [staffAssignedElsewhere, setStaffAssignedElsewhere] = useState({})
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')

  const loadRooms = useCallback(async (isSubscribed = () => true) => {
    setLoading(true)
    setError('')
    try {
      const data = await inventoryService.getLabRooms()
      const roomItems = getList(data, ['items', 'labRooms'])
      const roomsWithStaffCounts = canManageStaff
        ? await Promise.all(roomItems.map(async (room) => {
            const staff = await inventoryService.getLabStaff(getRoomId(room))
            return {
              ...room,
              assignedStaff: Array.isArray(staff) ? staff : [],
            }
          }))
        : roomItems
      if (isSubscribed()) setRooms(roomsWithStaffCounts)
    } catch (loadError) {
      if (isSubscribed()) {
        setError(extractErrorMessage(loadError, 'Không thể tải danh sách phòng lab.'))
        setRooms([])
      }
    } finally {
      if (isSubscribed()) setLoading(false)
    }
  }, [canManageStaff])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => loadRooms(() => active))
    return () => {
      active = false
    }
  }, [loadRooms])

  const loadAssignmentData = useCallback(async (room, isSubscribed = () => true) => {
    setAssignmentLoading(true)
    setAssignmentError('')
    try {
      const currentRoomId = getRoomId(room)
      const [roomStaffLists, usersResult] = await Promise.all([
        Promise.all(rooms.map(async (listedRoom) => ({
          room: listedRoom,
          staff: await inventoryService.getLabStaff(getRoomId(listedRoom)),
        }))),
        getAllActiveLabStaff(),
      ])
      if (!isSubscribed()) return

      const currentRoomStaff = roomStaffLists.find(
        ({ room: listedRoom }) => String(getRoomId(listedRoom)) === String(currentRoomId)
      )?.staff || []
      const alreadyAssigned = {}
      roomStaffLists.forEach(({ room: listedRoom, staff }) => {
        if (String(getRoomId(listedRoom)) === String(currentRoomId)) return
        staff.forEach((member) => {
          const staffId = getStaffId(member)
          if (staffId) alreadyAssigned[String(staffId)] = getRoomName(listedRoom) || getRoomCode(listedRoom)
        })
      })

      setAssignedStaff(currentRoomStaff)
      setStaffOptions(usersResult)
      setStaffAssignedElsewhere(alreadyAssigned)
    } catch (loadError) {
      if (isSubscribed()) {
        setAssignmentError(extractErrorMessage(loadError, 'Không thể tải danh sách phân công nhân viên.'))
        setAssignedStaff([])
        setStaffOptions([])
        setStaffAssignedElsewhere({})
      }
    } finally {
      if (isSubscribed()) setAssignmentLoading(false)
    }
  }, [rooms])

  const openCreateRoom = () => {
    setEditingRoom(null)
    setRoomName('')
    setRoomActive(true)
    setError('')
    setRoomDialogOpen(true)
  }

  const openEditRoom = (room) => {
    setEditingRoom(room)
    setRoomName(getRoomName(room))
    setRoomActive(isRoomActive(room))
    setError('')
    setRoomDialogOpen(true)
  }

  const handleSaveRoom = async (event) => {
    event.preventDefault()
    const trimmedName = roomName.trim()
    if (!trimmedName) {
      setError('Vui lòng nhập tên phòng lab.')
      return
    }
    if (trimmedName.length > 100) {
      setError('Tên phòng lab không được vượt quá 100 ký tự.')
      return
    }

    setSavingRoom(true)
    setError('')
    try {
      if (editingRoom) {
        await inventoryService.updateLabRoom(getRoomId(editingRoom), {
          roomName: trimmedName,
          status: roomActive ? 'Active' : 'Inactive',
          isActive: roomActive,
        })
      } else {
        await inventoryService.createLabRoom({ roomName: trimmedName })
      }
      setRoomDialogOpen(false)
      setNotice(editingRoom ? 'Đã cập nhật thông tin.' : 'Tạo phòng thành công.')
      await loadRooms()
    } catch (saveError) {
      setError(extractErrorMessage(saveError, 'Không thể lưu thông tin phòng.'))
    } finally {
      setSavingRoom(false)
    }
  }

  const openAssignmentDialog = async (room) => {
    setAssignmentRoom(room)
    setSelectedStaffId('')
    setAssignmentError('')
    setAssignmentDialogOpen(true)
    await loadAssignmentData(room)
  }

  const handleAddStaff = async (event) => {
    event.preventDefault()
    if (!assignmentRoom || !selectedStaffId) return

    setSavingAssignment(true)
    setAssignmentError('')
    try {
      const currentRoomId = getRoomId(assignmentRoom)
      const assignments = await Promise.all(
        rooms.map(async (room) => ({
          room,
          staff: await inventoryService.getLabStaff(getRoomId(room)),
        }))
      )
      const conflictingRoom = assignments.find(({ staff }) =>
        staff.some((member) => String(getStaffId(member)) === String(selectedStaffId))
      )?.room
      if (conflictingRoom) {
        const staffName = staffOptions.find((staff) => String(getStaffId(staff)) === String(selectedStaffId))
        const alreadyInThisRoom = String(getRoomId(conflictingRoom)) === String(currentRoomId)
        const conflictMessage = alreadyInThisRoom
          ? `${getStaffName(staffName)} đã được phân công cho phòng này.`
          : `${getStaffName(staffName)} đã được phân công cho phòng ${getRoomName(conflictingRoom) || getRoomCode(conflictingRoom)}. Mỗi LabStaff chỉ được phụ trách một phòng lab.`
        if (!alreadyInThisRoom) {
          setStaffAssignedElsewhere((previous) => ({
            ...previous,
            [String(selectedStaffId)]: getRoomName(conflictingRoom) || getRoomCode(conflictingRoom),
          }))
        }
        setSelectedStaffId('')
        setAssignmentError(conflictMessage)
        return
      }

      await inventoryService.assignLabStaff(currentRoomId, { userId: selectedStaffId })
      setSelectedStaffId('')
      setNotice(`Đã phân công nhân viên cho phòng ${getRoomName(assignmentRoom)}.`)
      await Promise.all([loadAssignmentData(assignmentRoom), loadRooms()])
    } catch (saveError) {
      setAssignmentError(extractErrorMessage(saveError, 'Không thể phân công nhân viên.'))
    } finally {
      setSavingAssignment(false)
    }
  }

  const handleRemoveStaff = async (staff) => {
    if (!assignmentRoom) return
    const staffId = getStaffId(staff)
    setAssignmentError('')
    setSavingAssignment(true)
    try {
      await inventoryService.removeLabStaff(getRoomId(assignmentRoom), staffId)
      setNotice(`Đã gỡ ${getStaffName(staff)} khỏi phòng lab.`)
      await Promise.all([loadAssignmentData(assignmentRoom), loadRooms()])
    } catch (removeError) {
      setAssignmentError(extractErrorMessage(removeError, 'Không thể gỡ nhân viên khỏi phòng lab.'))
    } finally {
      setSavingAssignment(false)
    }
  }

  if (!canManageRooms) {
    return (
      <PortalLayout headerTitle="Quản lý phòng lab">
        <Alert severity="error">Bạn không có quyền quản lý phòng lab.</Alert>
      </PortalLayout>
    )
  }

  return (
    <PortalLayout
      headerTitle="Quản lý phòng lab"
      headerSubtitle="Quản lý thông tin phòng và phân công nhân viên phụ trách"
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

        <Paper variant="outlined" sx={{ borderColor: '#d8dced', overflow: 'hidden' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#182238', fontSize: 16 }}>Danh sách phòng lab</Typography>
            </Box>
            {canEditRooms && (
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                onClick={openCreateRoom}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0058be', whiteSpace: 'nowrap' }}
              >
                Tạo phòng
              </Button>
            )}
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#faf9ff' }}>
                  {['Mã phòng', 'Tên phòng', 'Số tủ', 'Nhân viên phụ trách', 'Trạng thái', 'Thao tác'].map((column) => (
                    <TableCell key={column} sx={{ fontWeight: 700, color: '#334155' }}>{column}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} sx={{ mr: 1, verticalAlign: 'middle' }} />
                      <Typography variant="body2" component="span" color="text.secondary">Đang tải danh sách phòng lab...</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rooms.map((room) => {
                  const active = isRoomActive(room)
                  const assignedStaffList = Array.isArray(room.assignedStaff)
                    ? room.assignedStaff
                    : (Array.isArray(room.staff) ? room.staff : [])
                  const staffLabels = assignedStaffList
                    .map((staff) => getStaffUsername(staff) || getStaffName(staff))
                    .filter(Boolean)
                  return (
                    <TableRow key={getRoomId(room)} hover>
                      <TableCell sx={{ fontWeight: 600, color: '#0058be' }}>{getRoomCode(room) || '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{getRoomName(room) || '—'}</TableCell>
                      <TableCell>{room.cabinetCount ?? room.activeCabinetCount ?? room.cabinetsCount ?? 0}</TableCell>
                      <TableCell>
                        {staffLabels.length > 0
                          ? staffLabels.join(', ')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                          color={active ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        {canEditRooms && (
                          <Button
                            size="small"
                            startIcon={<EditIcon fontSize="small" />}
                            onClick={() => openEditRoom(room)}
                            sx={{ textTransform: 'none', mr: 0.5 }}
                          >
                            Sửa
                          </Button>
                        )}
                        {canManageStaff && (
                          <Button
                            size="small"
                            startIcon={<PersonAddIcon fontSize="small" />}
                            onClick={() => openAssignmentDialog(room)}
                            sx={{ textTransform: 'none' }}
                          >
                            Phân công
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!loading && rooms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                      Chưa có phòng lab.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={roomDialogOpen} onClose={() => !savingRoom && setRoomDialogOpen(false)} fullWidth maxWidth="sm">
          <Box component="form" onSubmit={handleSaveRoom}>
            <DialogTitle sx={{ fontWeight: 800 }}>{editingRoom ? 'Điều chỉnh' : 'Tạo phòng'}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                required
                autoFocus
                label="Tên phòng lab"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                helperText={`${roomName.length}/100`}
              />
              {editingRoom && (
                <TextField
                  select
                  label="Trạng thái"
                  value={roomActive ? 'Active' : 'Inactive'}
                  onChange={(event) => setRoomActive(event.target.value === 'Active')}
                  helperText="Không thể ngừng hoạt động nếu phòng còn tủ đang hoạt động."
                >
                  <MenuItem value="Active">Đang hoạt động</MenuItem>
                  <MenuItem value="Inactive">Ngừng hoạt động</MenuItem>
                </TextField>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setRoomDialogOpen(false)} disabled={savingRoom} sx={{ textTransform: 'none' }}>Hủy</Button>
              <Button type="submit" variant="contained" disabled={savingRoom} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {savingRoom ? 'Đang lưu...' : editingRoom ? 'Cập nhật' : 'Tạo'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>

        <Dialog
          open={assignmentDialogOpen}
          onClose={() => !savingAssignment && setAssignmentDialogOpen(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle sx={{ fontWeight: 800 }}>
            Phân công
            {assignmentRoom && ` — ${getRoomName(assignmentRoom)}`}
          </DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
            {assignmentError && <Alert severity="error" onClose={() => setAssignmentError('')}>{assignmentError}</Alert>}
            <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 1.5, bgcolor: '#f8fafc' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Nhân viên phụ trách:
              </Typography>
              {assignmentLoading ? (
                <CircularProgress size={22} />
              ) : assignedStaff.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Chưa có nhân viên được phân công.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {assignedStaff.map((staff) => (
                    <Box
                      key={getStaffId(staff)}
                      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, bgcolor: '#fff', border: '1px solid #e2e8f0', borderRadius: 1 }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{getStaffName(staff)}</Typography>
                        <Typography variant="caption" color="text.secondary">{staff.email || staff.user?.email || staff.username || ''}</Typography>
                      </Box>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleRemoveStaff(staff)}
                        disabled={savingAssignment}
                        sx={{ textTransform: 'none' }}
                      >
                        Gỡ
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box component="form" onSubmit={handleAddStaff} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Chọn nhân viên"
                value={selectedStaffId}
                onChange={(event) => setSelectedStaffId(event.target.value)}
                helperText="Mỗi nhân viên chỉ được phân công 1 phòng."
                disabled={assignmentLoading || staffOptions.length === 0}
              >
                {staffOptions.map((staff) => {
                  const staffId = getStaffId(staff)
                  const assignedRoom = staffAssignedElsewhere[String(staffId)]
                  const alreadyInThisRoom = assignedStaff.some(
                    (member) => String(getStaffId(member)) === String(staffId)
                  )
                  return (
                    <MenuItem
                      key={staffId}
                      value={staffId}
                      disabled={Boolean(assignedRoom) || alreadyInThisRoom}
                    >
                      {getStaffName(staff)}
                      {assignedRoom ? ` — đã phân công: ${assignedRoom}` : alreadyInThisRoom ? ' — đã có trong phòng' : ''}
                    </MenuItem>
                  )
                })}
                {staffOptions.length === 0 && <MenuItem disabled value="">Không có tài khoản LabStaff đang hoạt động.</MenuItem>}
              </TextField>
              <Button
                type="submit"
                variant="contained"
                disabled={!selectedStaffId || assignmentLoading || savingAssignment}
                sx={{ whiteSpace: 'nowrap', textTransform: 'none', minHeight: 40 }}
              >
                {savingAssignment ? 'Đang phân công...' : 'Phân công'}
              </Button>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAssignmentDialogOpen(false)} disabled={savingAssignment} sx={{ textTransform: 'none' }}>Đóng</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PortalLayout>
  )
}
