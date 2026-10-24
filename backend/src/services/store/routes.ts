import { Hono } from "hono"
import { requireAdmin } from "../../shared/auth/require-admin"
import { requireDatabase } from "../../shared/db/require-database"
import { mountImageUploads } from "../../shared/uploads/image-uploads"
import { adminOrdersRoute, ordersRoute } from "./orders"
import { adminProductsRoute, productsRoute } from "./products"
import { productImages } from "./storage"
import { adminCategoriesRoute } from "./categories"
import { adminReviewsRoute, productReviewsRoute, reviewsRoute } from "./reviews"

// 덕지 스토어 (굿즈샵): 상품은 관리자가 등록, 주문은 덕지 포인트(DP)로 결제
// 공개: /api/store/products(/:id/reviews)   회원: /api/store/orders, /api/store/reviews   관리자: /api/store/admin/products·orders·categories·reviews
export const storeRoute = new Hono()

storeRoute.use("*", requireDatabase)

storeRoute.route("/products", productReviewsRoute)
storeRoute.route("/products", productsRoute)
storeRoute.route("/reviews", reviewsRoute)
storeRoute.route("/admin/categories", adminCategoriesRoute)
storeRoute.route("/admin/reviews", adminReviewsRoute)
storeRoute.route("/orders", ordersRoute)
storeRoute.route("/admin/products", adminProductsRoute)
storeRoute.route("/admin/orders", adminOrdersRoute)

// 상품 사진 업로드 (관리자): POST /admin/uploads { contentType, size }
mountImageUploads(storeRoute, productImages, {
  ticketPath: "/admin/uploads",
  localUploadPath: "/admin/uploads/local/",
  localServePath: "/uploads/local/",
  serviceBasePath: "/api/store",
  guard: requireAdmin,
})
