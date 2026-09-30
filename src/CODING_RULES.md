# CODING RULES - SmartLabKit Frontend

## 1. Kiến trúc
- Tách rõ: pages / components / services / hooks / context / theme
- Mỗi trang nằm trong folder riêng (ví dụ: pages/Login/Login.jsx)
- Component dùng chung để trong components/common hoặc components/layout

## 2. Material UI
- Chỉ sử dụng @mui/material và @mui/icons-material
- Ưu tiên dùng prop `sx` thay vì tạo nhiều file css
- Không dùng styled-components hay css module trừ khi thật cần

## 3. Comment
- Chỉ viết comment ở những chỗ thật sự cần thiết và hữu ích
- Các hàm / đoạn logic phức tạp (validation, xử lý form, điều hướng, useEffect, logic nghiệp vụ…) phải có comment giải thích rõ mục đích và cách hoạt động
- Comment phải giúp người khác (hoặc AI sau này) hiểu nhanh và chỉnh sửa đúng, không viết comment cho có
- Viết bằng tiếng Việt dễ hiểu
