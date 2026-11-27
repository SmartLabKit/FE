import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
  // Một font (Roboto, tải trong index.html) và 7 cỡ chữ: 11 · 12 · 13 · 14 · 16 · 20 · 24
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h3: { fontSize: '1.5rem' },
    h4: { fontSize: '1.5rem' },
    h5: { fontSize: '1.25rem' },
    h6: { fontSize: '1rem' },
    subtitle1: { fontSize: '0.875rem' },
    subtitle2: { fontSize: '0.8125rem' },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.8125rem' },
    caption: { fontSize: '0.75rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none' } },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none' } },
    },
    MuiAlert: {
      defaultProps: { closeText: 'Đóng' },
    },
    MuiAutocomplete: {
      defaultProps: {
        openText: 'Mở danh sách',
        closeText: 'Đóng danh sách',
        clearText: 'Xóa',
        noOptionsText: 'Không có lựa chọn phù hợp',
        loadingText: 'Đang tải...',
      },
    },
    MuiTablePagination: {
      defaultProps: {
        labelRowsPerPage: 'Số dòng mỗi trang:',
        labelDisplayedRows: ({ from, to, count }) => `${from}–${to} / ${count !== -1 ? count : `hơn ${to}`}`,
        getItemAriaLabel: (type) =>
          ({ first: 'Trang đầu', last: 'Trang cuối', next: 'Trang sau', previous: 'Trang trước' })[type] || type,
      },
    },
  },
})

export default theme
