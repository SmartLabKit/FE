import { useEffect, useState } from 'react'
import { Box, MenuItem, Paper, Tab, Tabs, TextField } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { inventoryService } from '../../services/inventoryService'
import { defaultPeriod } from './reportFormat'
import InventoryReportsTab from './InventoryReportsTab'
import ReceiptLossReportsTab from './ReceiptLossReportsTab'
import StockMovementTab from './StockMovementTab'
import BorrowReportsTab from './BorrowReportsTab'
import IssueReportsTab from './IssueReportsTab'

export default function Reports() {
  const { hasRole } = useAuth()
  const isAdminOrManager = hasRole?.('Admin') || hasRole?.('InventoryManager')
  const isLabStaff = hasRole?.('LabStaff')
  const seesInventory = isAdminOrManager || isLabStaff

  // Danh sách tab theo role, khớp với phân quyền phía BE:
  // - Báo cáo có tiền (giá trị kho, nhập kho, hao hụt) chỉ Admin / InventoryManager.
  // - Giảng viên chỉ xem báo cáo mượn trả (BE tự giới hạn theo lớp của mình).
  const tabs = [
    seesInventory && { value: 'inventory', label: 'Tồn kho' },
    isAdminOrManager && { value: 'receipts', label: 'Nhập kho & hao hụt' },
    seesInventory && { value: 'movements', label: 'Thẻ kho' },
    { value: 'borrowing', label: 'Mượn trả' },
    seesInventory && { value: 'issues', label: 'Sự cố' },
  ].filter(Boolean)

  // Tab đang chọn lưu trên URL (?tab=...) để từ trang Tổng quan có thể mở thẳng đúng tab
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab = tabs.some((item) => item.value === requestedTab) ? requestedTab : tabs[0].value

  // Bộ lọc dùng chung cho mọi tab
  const [period, setPeriod] = useState(defaultPeriod)
  const [roomId, setRoomId] = useState('')
  const [labRooms, setLabRooms] = useState([])

  useEffect(() => {
    if (!seesInventory) return undefined
    let active = true
    inventoryService.getLabRooms()
      .then((items) => { if (active) setLabRooms(items) })
      .catch(() => { if (active) setLabRooms([]) })
    return () => { active = false }
  }, [seesInventory])

  const filters = {
    fromDate: period.fromDate || undefined,
    toDate: period.toDate || undefined,
    roomId: roomId || undefined,
  }

  return (
    <PortalLayout headerTitle="Báo cáo" headerSubtitle="Thống kê kho, mượn trả và sự cố theo kỳ">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Paper variant="outlined" sx={{ mb: 2, borderColor: '#d8dced' }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setSearchParams({ tab: value }, { replace: true })}
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label="Nhóm báo cáo"
          >
            {tabs.map((item) => (
              <Tab key={item.value} value={item.value} label={item.label} sx={{ textTransform: 'none', fontWeight: 600 }} />
            ))}
          </Tabs>
          <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', borderTop: '1px solid #eef0f6' }}>
            <TextField
              type="date"
              size="small"
              label="Từ ngày"
              value={period.fromDate}
              onChange={(event) => setPeriod((prev) => ({ ...prev, fromDate: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="date"
              size="small"
              label="Đến ngày"
              value={period.toDate}
              onChange={(event) => setPeriod((prev) => ({ ...prev, toDate: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {seesInventory && (
              <TextField
                select
                size="small"
                label="Phòng Lab"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">Tất cả phòng Lab</MenuItem>
                {labRooms.map((room) => (
                  <MenuItem key={room.roomId} value={room.roomId}>
                    {room.roomCode} · {room.roomName}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>
        </Paper>

        {tab === 'inventory' && <InventoryReportsTab filters={filters} canSeeMoney={isAdminOrManager} />}
        {tab === 'receipts' && <ReceiptLossReportsTab filters={filters} />}
        {tab === 'movements' && <StockMovementTab filters={filters} />}
        {tab === 'borrowing' && <BorrowReportsTab filters={filters} />}
        {tab === 'issues' && <IssueReportsTab filters={filters} />}
      </Box>
    </PortalLayout>
  )
}
