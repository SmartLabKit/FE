/** Quy tắc mật khẩu giống backend (Create user, Change password, Reset password): 8–72 ký tự, có chữ hoa, chữ thường và chữ số. */
export const PASSWORD_HINT = 'Tối thiểu 8 ký tự, có chữ hoa, chữ thường và chữ số'

export function passwordError(password) {
  if (!password) return 'Vui lòng nhập mật khẩu'
  if (password.length < 8) return 'Mật khẩu tối thiểu 8 ký tự'
  if (password.length > 72) return 'Mật khẩu tối đa 72 ký tự'
  if (!/[A-Z]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ hoa'
  if (!/[a-z]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ thường'
  if (!/[0-9]/.test(password)) return 'Mật khẩu phải có ít nhất 1 chữ số'
  return ''
}
