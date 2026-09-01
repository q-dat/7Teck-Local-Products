# Local Product Manager — MongoDB + Cloudinary

Source Next.js 16 giữ nguyên flow của `LocalProductsPage`, nhưng thay toàn bộ tầng lưu trữ chính:

- MongoDB lưu sản phẩm, cấu hình, lịch, Fanpage, Group và trạng thái DONE.
- Cloudinary lưu ảnh chính và ảnh nội bộ.
- Không dùng IndexedDB cho dữ liệu nghiệp vụ.
- Không có Vercel Blob và không còn nút/logic Đồng bộ.
- `localStorage` chỉ còn dùng cho cấu hình thông báo của chính thiết bị; `sessionStorage` chỉ còn dùng cho trạng thái ảnh đã tải trong phiên như flow cũ.

## Vì sao phù hợp với dữ liệu khoảng 200 MB

Ảnh không được nhét vào MongoDB. MongoDB chỉ lưu URL và metadata nhỏ nên mỗi document không tiến gần giới hạn 16 MB. Dung lượng ảnh nằm ở Cloudinary và được upload trực tiếp từ trình duyệt, vì vậy file ảnh lớn không đi qua giới hạn body của Vercel Function.

## Bảo toàn ảnh gốc

Luồng upload không dùng Canvas, không resize, không nén, không đổi JPG/WebP và không thêm transformation Cloudinary. File gốc được gửi thẳng đến endpoint `image/upload`; app lưu:

- URL gốc không có transformation;
- `public_id`, `asset_id`, version, format, kích thước, số byte và ETag;
- tên file gốc;
- checksum SHA-256 tính từ file trước khi upload.

Các nút tải ảnh cũng fetch asset gốc và giữ đúng định dạng. Canvas chỉ còn được dùng riêng khi trình duyệt bắt buộc chuyển sang PNG để copy ảnh vào clipboard; việc này không sửa asset trên Cloudinary.

## Xóa ảnh Cloudinary

- Sửa sản phẩm: API so sánh `public_id` trước/sau và xóa các ảnh đã bị loại.
- Xóa sản phẩm: xóa document MongoDB rồi xóa toàn bộ ảnh chính/nội bộ của sản phẩm.
- Hủy bản nháp hoặc bỏ một ảnh mới trước khi lưu: gọi API dọn ảnh chưa gắn sản phẩm.
- Xóa toàn bộ dữ liệu: xóa collection sản phẩm, app state và mọi ảnh được tham chiếu.
- API chỉ cho phép xóa `public_id` nằm trong `CLOUDINARY_UPLOAD_FOLDER`.

## Cài đặt local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`.

## Biến môi trường

Sao chép `.env.example` thành `.env.local`, sau đó thay value thật:

```dotenv
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/local_products?retryWrites=true&w=majority
MONGODB_DB_NAME=local_products
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_FOLDER=local-products
NEXT_PUBLIC_MAX_IMAGE_BYTES=0
```

`CLOUDINARY_API_SECRET` chỉ được dùng trong API server và tuyệt đối không thêm tiền tố `NEXT_PUBLIC_`.

## Deploy Vercel

1. Tạo MongoDB Atlas database và database user.
2. Trong Atlas Network Access, cho phép kết nối từ Vercel. Với serverless thường dùng `0.0.0.0/0`, kèm mật khẩu mạnh và user chỉ có quyền trên database này.
3. Lấy Cloud name/API key/API secret trong Cloudinary Dashboard.
4. Import repository vào Vercel.
5. Thêm toàn bộ biến trong `.env.example` vào Project Settings → Environment Variables.
6. Deploy; không cần Vercel Blob Store.
7. Bật Vercel Deployment Protection hoặc lớp đăng nhập của dự án trước khi đưa production, vì đây là trang quản trị có API sửa/xóa dữ liệu.

## Import backup LocalPage cũ

Modal Data vẫn nhận JSON/JSON.GZ. Nếu ảnh trong backup cũ là Base64, app sẽ upload từng byte hiện có trong backup lên Cloudinary trước khi ghi MongoDB. Lưu ý: nếu LocalPage cũ đã nén ảnh trước lúc tạo backup thì không thể phục hồi chất lượng cao hơn dữ liệu đã có; ảnh mới nhập trong source này luôn đi theo luồng nguyên bản.

Backup phiên bản mới là manifest JSON chứa metadata và URL Cloudinary, không nhúng lại hàng trăm MB Base64.

## API chính

| Route | Chức năng |
|---|---|
| `GET /api/local-products/bootstrap` | Tải sản phẩm và app state một lần |
| `PUT /api/local-products/products/:id` | Tạo/sửa sản phẩm, dọn ảnh bị loại |
| `DELETE /api/local-products/products/:id` | Xóa sản phẩm và ảnh Cloudinary |
| `PUT /api/local-products/products` | Thay toàn bộ danh sách khi import |
| `PATCH /api/local-products/state` | Lưu settings/lịch/trạng thái |
| `POST /api/local-products/cloudinary/sign` | Ký upload trực tiếp |
| `DELETE /api/local-products/cloudinary/delete` | Dọn ảnh bản nháp chưa gắn sản phẩm |
| `DELETE /api/local-products/reset` | Xóa toàn bộ MongoDB + ảnh được quản lý |

## Kiểm tra trước deploy

```bash
npm run lint
npm run build
```

Commit đề xuất:

```text
feat: migrate Local Product Manager to MongoDB and Cloudinary
```
