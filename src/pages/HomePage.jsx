import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="bg-white text-[#131b2e] min-h-screen" style={{ fontFamily: 'Geist, sans-serif' }}>

      {/* Navigation */}
      <nav className="bg-white border-b border-[#e4e6ef] flex h-[72px] items-center justify-between px-16 sticky top-0 z-50">
        <div className="flex gap-3 items-center">
          <div className="bg-[#0058be] flex items-center justify-center rounded w-8 h-8">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1" fill="white"/><rect x="13" y="4" width="7" height="7" rx="1" fill="white"/><rect x="4" y="13" width="7" height="7" rx="1" fill="white"/><rect x="13" y="13" width="7" height="7" rx="1" fill="white"/></svg>
          </div>
          <span className="font-bold text-[#0058be] text-lg">SmartLabKit</span>
        </div>
        <div className="hidden md:flex gap-8 items-center text-[#424754] text-sm">
          <a href="#" className="hover:text-[#0058be] transition-colors">Giải pháp</a>
          <a href="#" className="hover:text-[#0058be] transition-colors">Tính năng</a>
          <a href="#" className="hover:text-[#0058be] transition-colors">Quy trình</a>
          <a href="#" className="hover:text-[#0058be] transition-colors">Về LabStock</a>
        </div>
        <div className="flex gap-3 items-center">
          <button type="button" onClick={() => navigate('/login')} className="border border-[#c2c6d6] text-[#424754] text-sm font-medium px-[18px] h-11 rounded hover:bg-gray-50 transition-colors">Đăng nhập</button>
          <button type="button" className="bg-[#0058be] text-white text-sm font-medium px-[18px] h-11 rounded hover:bg-[#0049a3] transition-colors">Yêu cầu dùng thử</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#faf8ff] px-16 py-16 flex flex-col lg:flex-row gap-16 items-center">
        <div className="flex-1 flex flex-col gap-6 items-start">
          <div className="bg-[#eaedff] flex gap-2 items-center px-3 py-2 rounded-sm">
            <div className="w-2 h-2 rounded-full bg-[#0058be]"></div>
            <span className="font-semibold text-[#0058be] text-xs">Nền tảng vận hành lab dành cho giáo dục</span>
          </div>
          <h1 className="font-bold text-[#131b2e] text-5xl leading-[1.08]">Kho linh kiện rõ ràng.<br/>Mượn thiết bị liền mạch.</h1>
          <p className="text-[#424754] text-lg leading-relaxed">SmartLabKit kết nối sinh viên, giảng viên và lab staff trong một quy trình thống nhất – từ tra cứu tồn kho, gửi yêu cầu, phê duyệt đến bàn giao và hoàn trả.</p>
          <div className="flex gap-3 flex-wrap">
            <button type="button" className="bg-[#0058be] text-white text-sm font-medium px-[18px] h-11 rounded flex items-center gap-2 hover:bg-[#0049a3] transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Khám phá nền tảng
            </button>
            <button type="button" className="border border-[#c2c6d6] text-[#424754] text-sm font-medium px-[18px] h-11 rounded hover:bg-gray-50 transition-colors">Xem cách hoạt động</button>
          </div>
          <div className="flex gap-5 flex-wrap">
            {['Triển khai theo học kỳ', 'Phân quyền theo vai trò', 'Truy vết đầy đủ'].map((t) => (
              <div key={t} className="flex gap-2 items-center">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#0058be" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                <span className="text-[#424754] text-xs">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative bg-[#0058be] rounded-lg overflow-hidden shrink-0 w-full lg:w-[560px] h-[480px] lg:h-[520px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0058be] to-[#003b80]"></div>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute bottom-6 left-6 right-6 bg-white rounded shadow-xl p-[18px] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[#131b2e] text-sm">Tồn kho đang hoạt động</p>
                <p className="text-[#6b7280] text-[11px] mt-0.5">Cập nhật 2 phút trước</p>
              </div>
              <div className="bg-[#ecfdf5] flex gap-1.5 items-center px-2 py-1 rounded-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[#059669]"></div>
                <span className="font-semibold text-[#059669] text-[11px]">Trực tuyến</span>
              </div>
            </div>
            <div className="flex gap-3">
              {[{ v: '3.856', l: 'Linh kiện sẵn sàng' }, { v: '27', l: 'Đơn đang mượn' }, { v: '98,4%', l: 'Bàn giao đúng hạn' }].map((m) => (
                <div key={m.l} className="bg-[#faf8ff] flex-1 flex flex-col gap-1 p-2.5 rounded-sm">
                  <p className="font-bold text-[#131b2e] text-base">{m.v}</p>
                  <p className="text-[#424754] text-[11px] leading-snug">{m.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="bg-white px-16 py-20 flex flex-col lg:flex-row gap-14 items-start">
        <div className="flex flex-col gap-6 shrink-0 lg:w-[360px]">
          <div className="flex flex-col gap-3">
            <p className="font-bold text-[#0058be] text-xs uppercase tracking-wide">Tính năng chính</p>
            <h2 className="font-bold text-[#131b2e] text-[32px] leading-[1.15]">Kiểm soát toàn bộ vòng đời thiết bị</h2>
            <p className="text-[#424754] text-base leading-[1.55]">Từ danh mục tổng đến từng giao dịch mượn trả, SmartLabKit giữ dữ liệu có cấu trúc và dễ truy vết.</p>
          </div>
          <div className="bg-[#0058be] flex flex-col gap-2.5 p-[18px] rounded w-full">
            <p className="font-bold text-white/70 text-[11px] uppercase tracking-wide">Thiết kế cho phòng lab</p>
            <p className="text-white text-sm leading-relaxed">Hỗ trợ linh kiện tiêu hao, thiết bị đo và bộ kit dùng chung trong cùng một hệ thống.</p>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { icon: <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="#0058be" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, title: 'Danh mục & tồn kho', desc: 'Theo dõi số lượng, danh mục, ngưỡng nhập thêm và vị trí lưu trữ theo từng mã linh kiện.' },
            { icon: <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="#0058be" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, title: 'QR & truy vết', desc: 'Quét để nhận diện, bàn giao hoặc kiểm kê; lưu lại lịch sử thao tác theo người dùng.' },
            { icon: <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="#0058be" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>, title: 'Phê duyệt có ngữ cảnh', desc: 'Thiết lập luồng duyệt theo vai trò, lớp học, đề tài và định mức sử dụng.' },
            { icon: <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="#0058be" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>, title: 'Mượn - trả minh bạch', desc: 'Theo dõi hạn trả, trạng thái bàn giao, sự cố và phương án thay thế trong một hồ sơ.' },
          ].map((f) => (
            <div key={f.title} className="border border-[#c2c6d6] flex flex-col justify-between h-[220px] p-6 rounded">
              <div className="bg-[#eaedff] flex items-center justify-center rounded-xl w-11 h-11">{f.icon}</div>
              <div className="flex flex-col gap-2">
                <p className="font-bold text-[#131b2e] text-base">{f.title}</p>
                <p className="text-[#424754] text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-[#faf8ff] px-16 py-20 flex flex-col gap-12 items-center">
        <div className="flex flex-col gap-3 items-center text-center max-w-[720px]">
          <p className="font-bold text-[#0058be] text-xs uppercase tracking-wide">Quy trình sử dụng</p>
          <h2 className="font-bold text-[#131b2e] text-[32px] leading-[1.15]">Từ nhu cầu đến hoàn trả trong 4 bước</h2>
          <p className="text-[#424754] text-base leading-[1.55]">Một quy trình đơn giản cho người dùng, nhưng vẫn đủ kiểm soát cho nhà trường và lab staff.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 w-full">
          {[
            { step: 'BƯỚC 01', title: 'Tìm & chọn', desc: 'Tra cứu linh kiện sẵn có theo danh mục, mã hoặc vị trí.', icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> },
            { step: 'BƯỚC 02', title: 'Gửi yêu cầu', desc: 'Nêu mục đích, học phần, số lượng và ngày hoàn trả dự kiến.', icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> },
            { step: 'BƯỚC 03', title: 'Duyệt & bàn giao', desc: 'Giảng viên phê duyệt; lab staff chuẩn bị và xác nhận bàn giao.', icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg> },
            { step: 'BƯỚC 04', title: 'Hoàn trả & đóng', desc: 'Kiểm tra tình trạng, ghi nhận hoàn trả hoặc xử lý sự cố.', icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg> },
          ].map((s) => (
            <div key={s.step} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="bg-[#0058be] flex items-center justify-center rounded w-12 h-12">{s.icon}</div>
                <span className="font-bold text-[#0058be] text-xs">{s.step}</span>
              </div>
              <div className="h-px bg-[#c2c6d6] w-full"></div>
              <div className="flex flex-col gap-2">
                <p className="font-bold text-[#131b2e] text-base">{s.title}</p>
                <p className="text-[#424754] text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white px-16 pt-14 pb-7 flex flex-col gap-11">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-10">
          <div className="flex flex-col gap-4 max-w-[360px]">
            <div className="flex gap-3 items-center">
              <div className="bg-[#0058be] flex items-center justify-center rounded w-9 h-9">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <span className="font-bold text-[#0058be] text-lg">SmartLabKit</span>
            </div>
            <p className="text-[#424754] text-sm leading-relaxed">Nền tảng quản lý kho linh kiện và mượn thiết bị dành cho phòng lab giáo dục.</p>
            <p className="text-[#0058be] text-xs">hello@smartlabkit.vn · 028 7300 2026</p>
          </div>
          <div className="flex gap-16 flex-wrap">
            {[
              { title: 'Sản phẩm', links: ['Tính năng', 'Quy trình', 'Bảo mật', 'Cập nhật'] },
              { title: 'Giải pháp', links: ['Cho sinh viên', 'Cho giảng viên', 'Cho lab staff', 'Cho nhà trường'] },
              { title: 'Hỗ trợ', links: ['Trung tâm trợ giúp', 'Tài liệu triển khai', 'Liên hệ', 'Trạng thái hệ thống'] },
            ].map((col) => (
              <div key={col.title} className="flex flex-col gap-3">
                <p className="font-bold text-[#131b2e] text-sm">{col.title}</p>
                <div className="flex flex-col text-[#424754] text-xs">
                  {col.links.map((l) => <a key={l} href="#" className="leading-8 hover:text-[#0058be] transition-colors whitespace-nowrap">{l}</a>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[#e4e6ef] pt-5 flex flex-col sm:flex-row justify-between gap-3 text-[#6b7280] text-[11px]">
          <p>© 2026 SmartLabKit. All rights reserved.</p>
          <div className="flex gap-5">
            {['Quyền riêng tư', 'Điều khoản', 'Tiếng Việt'].map((t) => <a key={t} href="#" className="hover:text-[#0058be] transition-colors">{t}</a>)}
          </div>
        </div>
      </footer>

    </div>
  )
}
