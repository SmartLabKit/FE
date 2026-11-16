import { Grid } from '@mui/material'
import { useReport } from '../../hooks/useReport'
import { reportService } from '../../services/reportService'
import { formatHours, formatNumber, toLabel } from './reportFormat'
import { GroupBars, ReportSection, StatTile } from './reportUi'
import { ShareDonut } from './reportCharts'

const toParts = (groups) => (groups || []).map((group) => ({ name: toLabel(group.key), value: group.count }))
const formatIssues = (value) => `${formatNumber(value)} sự cố`

/** Tab "Sự cố": thống kê báo cáo sự cố tạo trong kỳ. */
export default function IssueReportsTab({ filters }) {
  const { fromDate, toDate } = filters
  const issues = useReport(() => reportService.getIssueSummary({ fromDate, toDate }), [fromDate, toDate])

  return (
    <ReportSection title="Thống kê sự cố" subtitle="Sự cố tạo trong kỳ" loading={issues.loading} error={issues.error}>
      {issues.data && (
        <>
          <Grid container spacing={2} sx={{ p: 2, pb: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}><StatTile label="Tổng số sự cố" value={formatNumber(issues.data.totalIssues)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><StatTile label="Thời gian xử lý trung bình" value={formatHours(issues.data.averageResolveHours)} /></Grid>
          </Grid>
          <Grid container>
            <Grid size={{ xs: 12, md: 4 }}>
              <ShareDonut title="Theo trạng thái" parts={toParts(issues.data.byStatus)} format={formatIssues} emptyText="Không có sự cố trong kỳ." />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <ShareDonut title="Theo loại sự cố" parts={toParts(issues.data.byType)} format={formatIssues} emptyText="Không có sự cố trong kỳ." />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <GroupBars title="Linh kiện nhiều sự cố nhất" groups={issues.data.topComponents} labelOf={(key) => key} />
            </Grid>
          </Grid>
        </>
      )}
    </ReportSection>
  )
}
