import "server-only";

const FAKE_ROWS = [
  {
    id: "DEMO-001",
    name: "Sản phẩm mẫu A",
    category: "Danh mục A",
    status: "ACTIVE",
  },
  {
    id: "DEMO-002",
    name: "Sản phẩm mẫu B",
    category: "Danh mục B",
    status: "ACTIVE",
  },
  {
    id: "DEMO-003",
    name: "Sản phẩm mẫu C",
    category: "Danh mục C",
    status: "DONE",
  },
  {
    id: "DEMO-004",
    name: "Sản phẩm mẫu D",
    category: "Danh mục A",
    status: "ACTIVE",
  },
  {
    id: "DEMO-005",
    name: "Sản phẩm mẫu E",
    category: "Danh mục B",
    status: "DONE",
  },
] as const;

export const API_GUARD_FAKE_TABLE = {
  columns: ["Mã sản phẩm", "Tên sản phẩm", "Danh mục", "Trạng thái"],
  rows: FAKE_ROWS,
} as const;
