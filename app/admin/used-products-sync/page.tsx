import UsedProductsSyncAdminClient from "./UsedProductsSyncAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Đồng Bộ & Quản Lý Used Products | 7Teck Admin",
  description: "Trang quản trị đối chiếu và đồng bộ sản phẩm used products",
};

export default function UsedProductsSyncPage() {
  return <UsedProductsSyncAdminClient />;
}
