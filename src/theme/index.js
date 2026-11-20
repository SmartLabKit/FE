import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
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
