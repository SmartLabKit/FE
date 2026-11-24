const codeOf = (lab) => lab?.roomCode || lab?.labRoomCode || ''
const nameOf = (lab) => lab?.roomName || lab?.labRoomName || ''

/** Nơi cần rõ: "LAB-01 · Lab IoT & Cảm biến". */
export const labLabel = (lab, fallback = '—') => [codeOf(lab), nameOf(lab)].filter(Boolean).join(' · ') || fallback

/** Nơi chật (bảng, thẻ): chỉ "LAB-01", tên đầy đủ để ở title khi rê chuột. */
export const labCode = (lab, fallback = '—') => codeOf(lab) || nameOf(lab) || fallback

export const labName = (lab) => nameOf(lab) || codeOf(lab)
