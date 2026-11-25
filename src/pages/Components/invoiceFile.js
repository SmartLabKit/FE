/** Loại tệp hóa đơn API nhận: ảnh JPG, PNG, WEBP hoặc PDF, tối đa 10 MB. */
export const INVOICE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf'

const MAX_INVOICE_BYTES = 10 * 1024 * 1024

/** Lỗi của tệp hóa đơn vừa chọn; hợp lệ thì trả ''. */
export function invoiceFileError(file) {
  if (!/\.(jpe?g|png|webp|pdf)$/i.test(file.name)) return 'Hóa đơn phải là ảnh JPG, PNG, WEBP hoặc file PDF.'
  if (file.size === 0) return 'Tệp hóa đơn rỗng.'
  if (file.size > MAX_INVOICE_BYTES) return 'Hóa đơn tối đa 10 MB.'
  return ''
}
