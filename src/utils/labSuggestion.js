/**
 * Gợi ý lab cho một danh mục: lab đang giữ nhiều linh kiện cùng danh mục nhất (theo roomCodes của linh kiện).
 * Trả về { roomCode, count } hoặc null khi chưa linh kiện nào cùng danh mục thuộc lab.
 * Danh mục dùng chung (điện trở, dây...) thường có ở mọi lab: khi đó lab đứng đầu cũng chỉ là gợi ý.
 */
export function suggestLabForCategory(components, categoryId, categoryName, preferredRoomCode) {
  const counts = new Map()
  ;(components || []).forEach((component) => {
    const sameCategory =
      (categoryId && component.categoryId === categoryId) ||
      (!categoryId && categoryName && component.categoryName === categoryName)
    if (!sameCategory) return
    ;(component.roomCodes || []).forEach((code) => counts.set(code, (counts.get(code) || 0) + 1))
  })
  let best = null
  counts.forEach((count, roomCode) => {
    if (!best || count > best.count || (count === best.count && roomCode < best.roomCode)) best = { roomCode, count }
  })
  // Ngang nhau (danh mục dùng chung) thì ưu tiên lab đang dùng, vd lab của phiếu nhập
  if (best && preferredRoomCode && counts.get(preferredRoomCode) === best.count) {
    return { roomCode: preferredRoomCode, count: best.count }
  }
  return best
}
