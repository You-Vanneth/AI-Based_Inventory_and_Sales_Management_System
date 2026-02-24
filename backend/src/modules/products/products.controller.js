import { created, fail, ok } from "../../utils/http.js";
import {
  createProductSchema,
  stockAdjustmentSchema,
  updateProductSchema
} from "./products.validator.js";
import {
  adjustStock,
  categoryExists,
  createProduct,
  existsProductBarcode,
  getProduct,
  getProductByBarcode,
  listProducts,
  softDeleteProduct,
  updateProduct
} from "./products.service.js";

function zodErrors(parsed) {
  return parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const q = String(req.query.q || "");
  const categoryId = req.query.category_id ? Number(req.query.category_id) : undefined;
  const lowStockOnly = req.query.low_stock_only === "1";

  const result = await listProducts({ page, limit, q, categoryId, lowStockOnly });
  return ok(res, result.rows, "Products fetched", { page, limit, total: result.total });
}

export async function getById(req, res) {
  const product = await getProduct(Number(req.params.productId));
  if (!product) return fail(res, 404, "Product not found", "PRODUCT_NOT_FOUND");
  return ok(res, product, "Product fetched");
}

export async function getByBarcode(req, res) {
  const product = await getProductByBarcode(String(req.params.barcode));
  if (!product) return fail(res, 404, "Product not found", "PRODUCT_NOT_FOUND");
  return ok(res, product, "Product fetched");
}

export async function create(req, res) {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));

  if (!(await categoryExists(parsed.data.category_id))) {
    return fail(res, 404, "Category not found", "CATEGORY_NOT_FOUND");
  }

  if (await existsProductBarcode(parsed.data.barcode)) {
    return fail(res, 409, "Barcode already exists", "BARCODE_EXISTS");
  }

  const product = await createProduct(parsed.data, req.user.user_id);
  return created(res, product, "Product created successfully");
}

export async function patch(req, res) {
  const productId = Number(req.params.productId);
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));

  const existing = await getProduct(productId);
  if (!existing) return fail(res, 404, "Product not found", "PRODUCT_NOT_FOUND");

  if (parsed.data.category_id && !(await categoryExists(parsed.data.category_id))) {
    return fail(res, 404, "Category not found", "CATEGORY_NOT_FOUND");
  }

  if (
    parsed.data.barcode &&
    (await existsProductBarcode(parsed.data.barcode, productId))
  ) {
    return fail(res, 409, "Barcode already exists", "BARCODE_EXISTS");
  }

  const product = await updateProduct(productId, parsed.data, req.user.user_id);
  return ok(res, product, "Product updated successfully");
}

export async function remove(req, res) {
  const productId = Number(req.params.productId);
  const existing = await getProduct(productId);
  if (!existing) return fail(res, 404, "Product not found", "PRODUCT_NOT_FOUND");

  await softDeleteProduct(productId, req.user.user_id);
  return ok(res, {}, "Product deleted successfully");
}

export async function stockAdjustment(req, res, next) {
  const productId = Number(req.params.productId);
  const parsed = stockAdjustmentSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));

  try {
    const product = await adjustStock(productId, parsed.data, req.user.user_id);
    return ok(res, product, "Stock adjusted successfully");
  } catch (error) {
    return next(error);
  }
}
