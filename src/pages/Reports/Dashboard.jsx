import {
  AssignmentTurnedIn as ApprovalIcon,
  Inventory as InventoryIcon,
  LocalShipping as IssueIcon,
  Paid as MoneyIcon,
  ReceiptLong as ReceiptIcon,
  SwapHoriz as BorrowIcon,
  WarningAmber as WarningIcon,
  AlarmOn as OverdueIcon,
} from '@mui/icons-material'
import { Alert, Box, Button, Chip, Grid } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { formatDate, formatMoney, formatNumber, getRows } from './reportFormat'
import { ReportSection, ReportTable, StatTile } from './reportUi'

const TILES = [
  { key: 'totalComponents', label: 'Linh kiện đang hoạt động', icon: <InventoryIcon />, format: formatNumber },
  { key: 'lowStockCount', label: 'Linh kiện sắp hết', icon: <WarningIcon />, color: '#ef6c00', format: formatNumber },
  { key: 'stockValue', label: 'Giá trị tồn kho', icon: <MoneyIcon />, format: formatMoney },
  { key: 'receiptsThisMonth', label: 'Phiếu nhập tháng này', icon: <ReceiptIcon />, format: formatNumber },
  { key: 'receiptAmountThisMonth', label: 'Tiền nhập tháng này', icon: <MoneyIcon />, format: formatMoney },
  { key: 'pendingApprovals', label: 'Đơn chờ duyệt', icon: <ApprovalIcon />, format: formatNumber },
  { key: 'readyToIssue', label: 'Đơn sẵn sàng giao', icon: <IssueIcon />, format: formatNumber },
  { key: 'borrowingCount', label: 'Đơn đang mượn', icon: <BorrowIcon />, format: formatNumber },
  { key: 'overdueCount', label: 'Đơn quá hạn', icon: <OverdueIcon />, color: '#c62828', format: formatNumber },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const seesInventory = hasRole?.('Admin') || hasRole?.('InventoryManager') || hasRole?.('LabStaff')

  const dashboard = useReport(() => reportService.getDashboard(), [])
  const lowStock = useReport(() => reportService.getLowStock({ page: 1, size: 5 }), [], seesInventory)
  const overdue = useReport(() => reportService.getOverdueBorrows({ page: 1, size: 5 }), [])

  const visibleTiles = TILES.filter((tile) => dashboard.data?.[tile.key] != null)

  return (
    <PortalLayout headerTitle="Tổng quan" headerSubtitle="Số liệu nhanh về kho và mượn trả">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {dashboard.error && <Alert severity="error" sx={{ mb: 2 }}>{dashboard.error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {visibleTiles.map((tile) => (
            <Grid key={tile.key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <StatTile
                label={tile.label}
                value={tile.format(dashboard.data[tile.key])}
                icon={tile.icon}
                color={tile.color}
              />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2}>
          {seesInventory && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <ReportSection
                title="Linh kiện sắp hết"
                subtitle="Thiếu nhiều nhất trước"
                loading={lowStock.loading}
                error={lowStock.error}
                action={
                  <Button size="small" onClick={() => navigate('/reports?tab=inventory')} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Xem tất cả
                  </Button>
                }
              >
                <ReportTable
                  rows={getRows(lowStock.data)}
                  rowKey={(row) => row.componentId}
                  emptyText="Không có linh kiện dưới mức tồn tối thiểu."
                  columns={[
                    { key: 'componentName', label: 'Linh kiện', render: (row) => <><b>{row.componentName}</b><br /><Box component="span" sx={{ color: '#0058be', fontSize: 12 }}>{row.componentCode}</Box></> },
                    { key: 'available', label: 'Còn', align: 'right', render: (row) => `${formatNumber(row.available)} ${row.unit || ''}` },
                    { key: 'minStock', label: 'Tối thiểu', align: 'right', render: (row) => formatNumber(row.minStock) },
                    { key: 'shortage', label: 'Thiếu', align: 'right', render: (row) => <Chip size="small" color="warning" label={formatNumber(row.shortage)} /> },
                  ]}
                />
              </ReportSection>
            </Grid>
          )}
          <Grid size={{ xs: 12, lg: seesInventory ? 6 : 12 }}>
            <ReportSection
              title="Đơn mượn quá hạn"
              subtitle="Trễ lâu nhất trước"
              loading={overdue.loading}
              error={overdue.error}
              action={
                <Button size="small" onClick={() => navigate('/reports?tab=borrowing')} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Xem tất cả
                </Button>
              }
            >
              <ReportTable
                rows={getRows(overdue.data)}
                rowKey={(row) => row.borrowRequestId}
                emptyText="Không có đơn mượn quá hạn."
                columns={[
                  { key: 'requestCode', label: 'Mã đơn', render: (row) => <Box component="span" sx={{ color: '#0058be', fontWeight: 600 }}>{row.requestCode}</Box> },
                  { key: 'requesterName', label: 'Người mượn' },
                  { key: 'dueDate', label: 'Hạn trả', render: (row) => formatDate(row.dueDate) },
                  { key: 'daysOverdue', label: 'Trễ', align: 'right', render: (row) => <Chip size="small" color="error" label={`${row.daysOverdue} ngày`} /> },
                ]}
              />
            </ReportSection>
          </Grid>
        </Grid>
      </Box>
    </PortalLayout>
  )
}
