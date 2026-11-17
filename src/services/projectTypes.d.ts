export interface BorrowDeadlineResponse {
  dueDate: string
  semesterCode: string
  daysLeft: number
  canBorrow: boolean
}

export interface SubmitProjectRequest {
  expectedBorrowDate: string | null
  dueDate: string | null
}
