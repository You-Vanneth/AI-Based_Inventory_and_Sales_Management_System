import { created, fail, ok } from "../../utils/http.js";
import { createCategorySchema, updateCategorySchema } from "./categories.validator.js";
import {
  createCategory,
  existsCategoryName,
  getCategory,
  listCategories,
  softDeleteCategory,
  updateCategory
} from "./categories.service.js";

function zodErrors(parsed) {
  return parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const q = String(req.query.q || "");
  const isActive = req.query.is_active !== undefined ? Number(req.query.is_active) : undefined;

  const result = await listCategories({ page, limit, q, isActive });
  return ok(res, result.rows, "Categories fetched", { page, limit, total: result.total });
}

export async function getById(req, res) {
  const category = await getCategory(Number(req.params.categoryId));
  if (!category) return fail(res, 404, "Category not found", "CATEGORY_NOT_FOUND");
  return ok(res, category, "Category fetched");
}

export async function create(req, res) {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));

  if (await existsCategoryName(parsed.data.category_name)) {
    return fail(res, 409, "Category name already exists", "CATEGORY_EXISTS");
  }

  const category = await createCategory(parsed.data, req.user.user_id);
  return created(res, category, "Category created successfully");
}

export async function patch(req, res) {
  const categoryId = Number(req.params.categoryId);
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 422, "Validation failed", "VALIDATION_ERROR", zodErrors(parsed));

  const existing = await getCategory(categoryId);
  if (!existing) return fail(res, 404, "Category not found", "CATEGORY_NOT_FOUND");

  if (
    parsed.data.category_name &&
    (await existsCategoryName(parsed.data.category_name, categoryId))
  ) {
    return fail(res, 409, "Category name already exists", "CATEGORY_EXISTS");
  }

  const category = await updateCategory(categoryId, parsed.data, req.user.user_id);
  return ok(res, category, "Category updated successfully");
}

export async function remove(req, res) {
  const categoryId = Number(req.params.categoryId);
  const existing = await getCategory(categoryId);
  if (!existing) return fail(res, 404, "Category not found", "CATEGORY_NOT_FOUND");

  await softDeleteCategory(categoryId, req.user.user_id);
  return ok(res, {}, "Category deleted successfully");
}
