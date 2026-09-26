# KPI CT FOOD

Ứng dụng quản trị KPI CT FOOD theo 3 phạm vi người dùng:

- HĐQT/BĐH: xem toàn công ty, điểm KPI, hiệu suất phòng ban, danh sách nhân viên, giao KPI.
- Trưởng phòng: xem phòng mình, hiệu suất nhân viên thuộc quyền, phân bổ KPI.
- Nhân viên: chỉ xem KPI cá nhân và tự ghi nhận doanh số/kết quả.

Database dùng Google Sheet KPI_CTFOOD, spreadsheet ID `1z2vVKOAuIiDvYXzIcY4nl-vARVaTb_PC-EsWN294NeM`.

Các tab chính: NHAN_VIEN, PHONG_BAN, DANH_MUC_KPI, KPI_THEO_VI_TRI, GIAO_CHI_TIEU, PHAN_BO_KPI, DOANH_SO_NV, KET_QUA_KPI, DIEU_CHINH_KPI, PHAN_QUYEN, NHAT_KY_HE_THONG, CAU_HINH.

Frontend mẫu sẽ chạy trên GitHub Pages/Cloudflare Pages. Backend dự kiến dùng Google Apps Script Web App để đọc/ghi Google Sheet và kiểm soát quyền theo ROLE + SCOPE + DEPARTMENT_ID + EMPLOYEE_ID.
