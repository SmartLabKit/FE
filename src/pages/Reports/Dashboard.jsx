import {
  AssignmentTurnedIn as ApprovalIcon,
  RemoveShoppingCart as OutOfStockIcon,
  LocalShipping as IssueIcon,
  Paid as MoneyIcon,
  ReceiptLong as ReceiptIcon,
  SwapHoriz as BorrowIcon,
  WarningAmber as WarningIcon,
  AlarmOn as OverdueIcon,
} from '@mui/icons-material'
import { Alert, Box, Button, Chip, Grid, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/layout/PortalLayout'
import { useAuth } from '../../context/AuthContext'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { projectService } from '../../services/projectService'
import { getVietnamDateInputValue } from '../../utils/dateFormatting'
import { formatDate, formatMoney, formatNumber, getRows } from './reportFormat'
import { ReportSection, ReportTable, StatTile } from './reportUi'

/** Tháng hiện tại theo giờ Việt Nam, dạng 11/2026. */
function currentMonthLabel() {
  const today = getVietnamDateInputValue()
  return `${today.slice(5, 7)}/${today.slice(0, 4)}`
}

function TileGroup({ title, tiles }) {
  if (tiles.length === 0) return null
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#475569', mb: 1, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {title}
      </Typography>
      <Grid container spacing={2}>
        {tiles.map((tile) => (
          <Grid key={tile.key} size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatTile {...tile} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const isLabStaff = hasRole?.('LabStaff')
  const isLecturer = hasRole?.('Lecturer')
  const managesInventory = hasRole?.('InventoryManager')
  const onlyWatchesInventory = hasRole?.('Admin') && !managesInventory
  const seesInventory = managesInventory || onlyWatchesInventory || isLabStaff

  const dashboard = useReport(() => reportService.getDashboard(), [])
  const lowStock = useReport(() => reportService.getLowStock({ page: 1, size: 5 }), [], seesInventory)
  const overdue = useReport(() => reportService.getOverdueBorrows({ page: 1, size: 5 }), [])
  const pendingProjects = useReport(() => projectService.getPendingApprovalProjects({ page: 1, size: 5 }), [], isLecturer)

  const data = dashboard.data || {}
  const has = (key) => data[key] != null

  let borrowLink = '/reports?tab=borrowing'
  if (isLabStaff) borrowLink = '/borrow/lab-orders'
  let pendingLink = borrowLink
  if (isLecturer) pendingLink = '/borrow/my-requests'
  let stockLink = '/components/catalog'
  if (managesInventory) stockLink = '/class-setup/admin/components'
  if (onlyWatchesInventory) stockLink = '/reports?tab=inventory'
  const receiptLink = managesInventory ? '/class-setup/admin/stock-receipts' : '/reports?tab=receipts'

  const actionTiles = [
    has('pendingApprovals') && {
      key: 'pendingApprovals',
      label: 'Đơn chờ GV duyệt',
      value: formatNumber(data.pendingApprovals),
      icon: <ApprovalIcon />,
      onClick: () => navigate(pendingLink),
    },
    has('readyToIssue') && {
      key: 'readyToIssue',
      label: 'Sẵn sàng giao',
      value: formatNumber(data.readyToIssue),
      icon: <IssueIcon />,
      onClick: () => navigate(borrowLink),
    },
    has('borrowingCount') && {
      key: 'borrowingCount',
      label: 'Đang mượn',
      value: formatNumber(data.borrowingCount),
      icon: <BorrowIcon />,
      onClick: () => navigate(borrowLink),
    },
    has('overdueCount') && {
      key: 'overdueCount',
      label: 'Quá hạn',
      value: formatNumber(data.overdueCount),
      icon: <OverdueIcon />,
      color: '#c62828',
      valueColor: data.overdueCount > 0 ? '#c62828' : undefined,
      onClick: () => navigate(borrowLink),
    },
  ].filter(Boolean)

  const stockTiles = [
    has('outOfStockCount') && {
      key: 'outOfStockCount',
      label: 'Hết hàng',
      value: formatNumber(data.outOfStockCount),
      hint: has('totalComponents') ? `trên ${formatNumber(data.totalComponents)} linh kiện` : undefined,
      icon: <OutOfStockIcon />,
      color: '#c62828',
      onClick: () => navigate(stockLink),
    },
    has('belowMinStockCount') && {
      key: 'belowMinStockCount',
      label: 'Dưới mức tối thiểu',
      value: formatNumber(data.belowMinStockCount),
      hint: 'vẫn còn hàng',
      icon: <WarningIcon />,
      color: '#ef6c00',
      onClick: () => navigate('/reports?tab=inventory'),
    },
    !has('outOfStockCount') && has('lowStockCount') && {
      key: 'lowStockCount',
      label: 'Linh kiện sắp hết',
      value: formatNumber(data.lowStockCount),
      icon: <WarningIcon />,
      color: '#ef6c00',
      onClick: () => navigate('/reports?tab=inventory'),
    },
    has('stockValue') && {
      key: 'stockValue',
      label: 'Giá trị tồn kho',
      value: formatMoney(data.stockValue),
      icon: <MoneyIcon />,
      onClick: () => navigate('/reports?tab=inventory'),
    },
    has('receiptAmountThisMonth') && {
      key: 'receiptAmountThisMonth',
      label: `Nhập kho tháng ${currentMonthLabel()}`,
      value: formatMoney(data.receiptAmountThisMonth),
      hint: has('receiptsThisMonth') ? `${formatNumber(data.receiptsThisMonth)} phiếu nhập` : undefined,
      icon: <ReceiptIcon />,
      onClick: () => navigate(receiptLink),
    },
  ].filter(Boolean)

  const overdueRows = getRows(overdue.data)
  const noOverdue = !overdue.loading && !overdue.error && overdueRows.length === 0

  const lowStockSection = seesInventory && (
    <ReportSection
      title="Linh kiện thiếu hàng"
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
          {
            key: 'available',
            label: 'Còn',
            align: 'right',
            render: (row) =>
              row.available > 0
                ? `${formatNumber(row.available)} ${row.unit || ''}`
                : <Chip size="small" color="error" variant="outlined" label="Hết hàng" />,
          },
          { key: 'minStock', label: 'Tối thiểu', align: 'right', render: (row) => `${formatNumber(row.minStock)} ${row.unit || ''}` },
        ]}
      />
    </ReportSection>
  )

  return (
    <PortalLayout headerTitle="Tổng quan" headerSubtitle="Số liệu nhanh về kho và mượn trả">
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        {dashboard.error && <Alert severity="error" sx={{ mb: 2 }}>{dashboard.error}</Alert>}

        <TileGroup title="Việc cần xử lý" tiles={actionTiles} />
        <TileGroup title="Kho" tiles={stockTiles} />

        {isLecturer && (
          <Box sx={{ mb: 2 }}>
            <ReportSection
              title="Đề tài chờ bạn duyệt"
              subtitle="Gửi sớm nhất trước"
              loading={pendingProjects.loading}
              error={pendingProjects.error}
              action={
                <Button size="small" onClick={() => navigate('/borrow/my-requests')} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Xem tất cả
                </Button>
              }
            >
              <ReportTable
                rows={getRows(pendingProjects.data)}
                rowKey={(row) => `${row.projectId}-${row.borrowRequestId || ''}`}
                emptyText="Không có đề tài nào chờ bạn duyệt."
                onRowClick={() => navigate('/borrow/my-requests')}
                columns={[
                  { key: 'title', label: 'Đề tài', render: (row) => <><b>{row.title}</b>{row.isSupplementary && <Chip size="small" label="Mượn bổ sung" sx={{ ml: 1 }} />}</> },
                  { key: 'teamName', label: 'Nhóm / Lớp', render: (row) => [row.teamName, row.classCode].filter(Boolean).join(' · ') || '—' },
                  { key: 'submittedAt', label: 'Ngày gửi', render: (row) => formatDate(row.submittedAt) },
                  { key: 'componentCount', label: 'Số linh kiện', align: 'right', render: (row) => formatNumber(row.componentCount) },
                ]}
              />
            </ReportSection>
          </Box>
        )}

        {noOverdue && (
          <Alert severity="success" sx={{ mb: 2 }}>Không có đơn mượn quá hạn.</Alert>
        )}

        <Grid container spacing={2}>
          {lowStockSection && (
            <Grid size={{ xs: 12, lg: noOverdue ? 12 : 6 }}>
              {lowStockSection}
            </Grid>
          )}
          {!noOverdue && (
            <Grid size={{ xs: 12, lg: seesInventory ? 6 : 12 }}>
              <ReportSection
                title="Đơn mượn quá hạn"
                subtitle="Trễ lâu nhất trước"
                loading={overdue.loading}
                error={overdue.error}
                action={
                  <Button size="small" onClick={() => navigate(borrowLink)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Xem tất cả
                  </Button>
                }
              >
                <ReportTable
                  rows={overdueRows}
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
          )}
        </Grid>
      </Box>
    </PortalLayout>
  )
}
