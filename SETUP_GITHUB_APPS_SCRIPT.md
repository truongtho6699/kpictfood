# Thiết lập GitHub → Google Apps Script

Repo đã có workflow tự động tại `.github/workflows/deploy-apps-script.yml`.

## 1. Tạo/mở Apps Script
Tạo một Apps Script project dùng cho KPI CT FOOD. Trong Project Settings, sao chép **Script ID**.

## 2. Bật Apps Script API
Mở https://script.google.com/home/usersettings và bật **Google Apps Script API**.

## 3. Cài Node.js + clasp trên máy
Yêu cầu Node.js 20+.

```bash
npm install -g @google/clasp
clasp login
```

Đăng nhập đúng tài khoản Google sở hữu/được quyền sửa Apps Script.

## 4. Tạo file .clasp.json tạm thời
Trong thư mục `apps-script`:

```json
{
  "scriptId": "SCRIPT_ID_CUA_BAN",
  "rootDir": "."
}
```

## 5. Kiểm tra kết nối
Trong thư mục `apps-script`:

```bash
clasp status
clasp push
```

Sau lần đăng nhập, clasp tạo file xác thực trong thư mục người dùng (thường là `~/.clasprc.json`).

## 6. Tạo GitHub Secrets
Repo → Settings → Secrets and variables → Actions → New repository secret.

Tạo:
- `CLASP_JSON`: toàn bộ nội dung file `.clasp.json`.
- `CLASPRC_JSON`: toàn bộ nội dung file xác thực clasp của tài khoản.

Không commit hai file bí mật này vào GitHub.

## 7. Kiểm tra GitHub Actions
Repo → Actions → Deploy Apps Script → Run workflow.

Nếu thành công, GitHub sẽ chạy `clasp push --force` và tạo một Apps Script version.

## 8. Web App
Lần đầu, tạo Web App deployment trong Apps Script:
Deploy → New deployment → Web app.

Sau đó lưu URL `/exec` để frontend KPI CT FOOD gọi API.

Từ đây, code trong thư mục `apps-script/` trên nhánh main là nguồn chuẩn. Không sửa Code.gs trực tiếp trên Apps Script nếu không đồng bộ ngược lại GitHub.
