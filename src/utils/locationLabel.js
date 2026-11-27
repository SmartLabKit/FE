/**
 * Vị trí lab + tủ. Mã tủ chuẩn đã chứa mã lab (LAB-01-T02) nên chỉ hiện mã tủ; tủ đặt tên khác thì ghép "LAB-01 · TU-A".
 */
export function locationLabel(roomCode, cabinetCode) {
  if (roomCode && cabinetCode && cabinetCode.startsWith(roomCode)) return cabinetCode
  return [roomCode, cabinetCode].filter(Boolean).join(' · ')
}
