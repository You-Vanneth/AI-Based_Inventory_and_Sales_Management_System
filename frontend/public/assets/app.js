const API_BASE = "/api/v1";
const LANG_KEY = "app_lang";
const SUPPORTED_LANGS = ["en", "km"];
let activeNavId = null;
let i18nObserver = null;
let isApplyingI18n = false;
const memoryStore = {};

const KM_TEXT_MAP = {
  "AI Inventory System": "ប្រព័ន្ធគ្រប់គ្រងស្តុកឆ្លាតវៃ",
  "Overview": "ទិដ្ឋភាពទូទៅ",
  "Operations": "ប្រតិបត្តិការ",
  "Insights": "វិភាគ",
  "Settings": "ការកំណត់",
  "Dashboard": "ផ្ទាំងគ្រប់គ្រង",
  "Users": "អ្នកប្រើប្រាស់",
  "Categories": "ប្រភេទ",
  "Products": "ផលិតផល",
  "Sales": "ការលក់",
  "Reports": "របាយការណ៍",
  "AI Forecast": "ព្យាករណ៍ AI",
  "Inventory Health": "សុខភាពស្តុក",
  "Inventory Health Center": "មជ្ឈមណ្ឌលសុខភាពស្តុក",
  "Monitor stock risk, expiry urgency, and restock priority in one place.": "តាមដានហានិភ័យស្តុក ភាពបន្ទាន់នៃការផុតកំណត់ និងអាទិភាពបញ្ចូលស្តុកនៅកន្លែងតែមួយ។",
  "Expiry Prioritization (FEFO)": "អាទិភាពផុតកំណត់ (FEFO)",
  "Days Window": "ចន្លោះថ្ងៃ",
  "Next 7 days": "7 ថ្ងៃខាងមុខ",
  "Next 14 days": "14 ថ្ងៃខាងមុខ",
  "Next 30 days": "30 ថ្ងៃខាងមុខ",
  "Low Stock Action Board": "ផ្ទាំងសកម្មភាពស្តុកទាប",
  "Restock Plan": "ផែនការបញ្ចូលស្តុក",
  "Out of Stock": "អស់ស្តុក",
  "Critical Expiry": "ផុតកំណត់បន្ទាន់",
  "No expiring products in this window.": "មិនមានផលិតផលជិតផុតកំណត់ក្នុងចន្លោះនេះទេ។",
  "Monitor": "តាមដាន",
  "Critical": "បន្ទាន់ខ្លាំង",
  "High": "ខ្ពស់",
  "Medium": "មធ្យម",
  "Normal": "ធម្មតា",
  "Email Alerts": "អ៊ីមែលជូនដំណឹង",
  "Logout": "ចាកចេញ",
  "Menu": "មឺនុយ",
  "Security": "សុវត្ថិភាព",
  "Inventory": "ស្តុក",
  "Tracked": "តាមដាន",
  "Forecast": "ព្យាករណ៍",
  "Ready": "រួចរាល់",
  "Sign In": "ចូលប្រើ",
  "Use your staff or admin account.": "សូមប្រើគណនីបុគ្គលិក ឬអ្នកគ្រប់គ្រង។",
  "Email": "អ៊ីមែល",
  "Password": "ពាក្យសម្ងាត់",
  "Login": "ចូល",
  "Smart Inventory Control": "ការគ្រប់គ្រងស្តុកឆ្លាតវៃ",
  "Professional management for products, sales, stock movement, and decision support.": "ការគ្រប់គ្រងវិជ្ជាជីវៈសម្រាប់ផលិតផល ការលក់ ចលនាស្តុក និងការគាំទ្រការសម្រេចចិត្ត។",
  "Operations Dashboard": "ផ្ទាំងប្រតិបត្តិការ",
  "Real-time visibility for inventory and sales performance.": "មើលទិន្នន័យស្តុក និងការលក់ទាន់ពេលវេលា។",
  "System Notes": "កំណត់ចំណាំប្រព័ន្ធ",
  "Dashboard data is loaded live from backend APIs.": "ទិន្នន័យ Dashboard ត្រូវបានទាញផ្ទាល់ពី backend APIs។",
  "14-Day Sales Trend": "និន្នាការលក់ 14 ថ្ងៃ",
  "Revenue": "ចំណូល",
  "Sales by Category": "ការលក់តាមប្រភេទ",
  "Top Categories": "ប្រភេទលក់ដាច់",
  "Top Selling Products": "ផលិតផលលក់ដាច់",
  "By Units Sold": "តាមចំនួនលក់",
  "Low Stock Watchlist": "បញ្ជីស្តុកទាប",
  "Restock": "បញ្ចូលស្តុក",
  "Total Products": "ផលិតផលសរុប",
  "Sales Today": "លក់ថ្ងៃនេះ",
  "Monthly Revenue": "ចំណូលប្រចាំខែ",
  "Low Stock Items": "ទំនិញស្តុកទាប",
  "Expiring Soon": "ជិតផុតកំណត់",
  "Active Role": "តួនាទីបច្ចុប្បន្ន",
  "Product": "ផលិតផល",
  "Products": "ផលិតផល",
  "Units": "ចំនួន",
  "Barcode": "បាកូដ",
  "Qty": "ចំនួន",
  "Min": "អប្បបរមា",
  "No category sales yet.": "មិនទាន់មានទិន្នន័យលក់តាមប្រភេទ។",
  "No sales data yet.": "មិនទាន់មានទិន្នន័យលក់។",
  "All products are above minimum stock.": "ផលិតផលទាំងអស់មានស្តុកលើសកម្រិតអប្បបរមា។",
  "Analytics endpoint is not available yet.": "Analytics endpoint មិនទាន់មាន។",
  "Category Management": "គ្រប់គ្រងប្រភេទ",
  "Create and maintain product categories for product assignment.": "បង្កើត និងគ្រប់គ្រងប្រភេទសម្រាប់ចាត់តាំងផលិតផល។",
  "Create Category": "បង្កើតប្រភេទ",
  "Category Name": "ឈ្មោះប្រភេទ",
  "Description": "ពិពណ៌នា",
  "Save Category": "រក្សាទុកប្រភេទ",
  "Category List": "បញ្ជីប្រភេទ",
  "Search": "ស្វែងរក",
  "Action": "សកម្មភាព",
  "Reload": "ផ្ទុកឡើងវិញ",
  "Name": "ឈ្មោះ",
  "Status": "ស្ថានភាព",
  "Edit": "កែប្រែ",
  "Delete": "លុប",
  "Email Settings": "ការកំណត់អ៊ីមែល",
  "Configure SMTP and alert rules for low stock and expiry notifications.": "កំណត់ SMTP និងច្បាប់ជូនដំណឹងសម្រាប់ស្តុកទាប និងជិតផុតកំណត់។",
  "SMTP Configuration": "កំណត់ SMTP",
  "SMTP Host": "ម៉ាស៊ីនមេ SMTP",
  "SMTP Port": "ច្រក SMTP",
  "SMTP User": "អ្នកប្រើ SMTP",
  "SMTP Password": "ពាក្យសម្ងាត់ SMTP",
  "Sender Name": "ឈ្មោះអ្នកផ្ញើ",
  "Sender Email": "អ៊ីមែលអ្នកផ្ញើ",
  "Use TLS (1/0)": "ប្រើ TLS (1/0)",
  "Expiry Alert Days": "ថ្ងៃជូនដំណឹងផុតកំណត់",
  "Low Stock Alert (1/0)": "ជូនដំណឹងស្តុកទាប (1/0)",
  "Expiry Alert (1/0)": "ជូនដំណឹងផុតកំណត់ (1/0)",
  "Save Settings": "រក្សាទុកការកំណត់",
  "Test Email": "តេស្តអ៊ីមែល",
  "To Email (optional)": "អ៊ីមែលអ្នកទទួល (ស្រេចចិត្ត)",
  "Send Test Email": "ផ្ញើអ៊ីមែលតេស្ត",
  "Product Management": "គ្រប់គ្រងផលិតផល",
  "Create and monitor product records with manual entry or camera barcode scan.": "បង្កើត និងតាមដានផលិតផលដោយវាយដៃ ឬស្កេនបាកូដតាមកាមេរ៉ា។",
  "Create Product": "បង្កើតផលិតផល",
  "Product Name": "ឈ្មោះផលិតផល",
  "Scan": "ស្កេន",
  "Category": "ប្រភេទ",
  "Quantity": "បរិមាណ",
  "Cost Price": "តម្លៃដើម",
  "Selling Price": "តម្លៃលក់",
  "Save Product": "រក្សាទុកផលិតផល",
  "Quick Stock Update by Barcode": "កែស្តុករហ័សតាមបាកូដ",
  "Scan or enter a barcode to increase/decrease stock for an existing product.": "ស្កេន ឬបញ្ចូលបាកូដ ដើម្បីបន្ថែម/បន្ថយស្តុកផលិតផលដែលមាន។",
  "Product Barcode": "បាកូដផលិតផល",
  "Find": "ស្វែងរក",
  "Adjustment Type": "ប្រភេទកែស្តុក",
  "Increase (+)": "បន្ថែម (+)",
  "Decrease (-)": "បន្ថយ (-)",
  "Reason": "មូលហេតុ",
  "Update Stock": "ធ្វើបច្ចុប្បន្នភាពស្តុក",
  "Product List": "បញ្ជីផលិតផល",
  "Price": "តម្លៃ",
  "Close": "បិទ",
  "Scan Barcode": "ស្កេនបាកូដ",
  "Reports Center": "មជ្ឈមណ្ឌលរបាយការណ៍",
  "Daily/Monthly sales, stock alerts, and AI reorder insight.": "របាយការណ៍លក់ប្រចាំថ្ងៃ/ខែ ជូនដំណឹងស្តុក និងយោបល់បញ្ជាទិញពី AI។",
  "Report Type": "ប្រភេទរបាយការណ៍",
  "Select Report": "ជ្រើសរបាយការណ៍",
  "Date From": "ចាប់ពីថ្ងៃ",
  "Date To": "ដល់ថ្ងៃ",
  "Run Report": "ដំណើរការរបាយការណ៍",
  "Result": "លទ្ធផល",
  "Sales Console": "ផ្ទាំងការលក់",
  "Create sales using barcode input or camera scan and track payment status instantly.": "បង្កើតការលក់ដោយបញ្ចូលបាកូដ ឬស្កេនកាមេរ៉ា និងតាមដានស្ថានភាពបង់ប្រាក់ភ្លាមៗ។",
  "Create Sale": "បង្កើតការលក់",
  "Payment Method": "វិធីបង់ប្រាក់",
  "Paid Amount": "ចំនួនប្រាក់បានបង់",
  "Create Sale": "បង្កើតការលក់",
  "Recent Sales": "ការលក់ថ្មីៗ",
  "Date": "កាលបរិច្ឆេទ",
  "By": "ដោយ",
  "Detail": "លម្អិត",
  "Void": "លុបសុពលភាព",
  "Sale Detail": "លម្អិតការលក់",
  "Scan Sale Barcode": "ស្កេនបាកូដសម្រាប់លក់",
  "User & Role Management": "គ្រប់គ្រងអ្នកប្រើ និងតួនាទី",
  "Admin can manage users, role permissions, account status, and edit user details from this page.": "Admin អាចគ្រប់គ្រងអ្នកប្រើ សិទ្ធិតួនាទី ស្ថានភាពគណនី និងកែព័ត៌មានអ្នកប្រើនៅទំព័រនេះ។",
  "Create User": "បង្កើតអ្នកប្រើ",
  "Full Name": "ឈ្មោះពេញ",
  "Role": "តួនាទី",
  "Create User": "បង្កើតអ្នកប្រើ",
  "User List": "បញ្ជីអ្នកប្រើ",
  "Actions": "សកម្មភាព",
  "Roles & Permissions": "តួនាទី និងសិទ្ធិ",
  "Configure which feature each system role can access (ADMIN / STAFF).": "កំណត់មុខងារណាដែលតួនាទីនីមួយៗអាចចូលប្រើបាន (ADMIN / STAFF)។",
  "System Roles": "តួនាទីប្រព័ន្ធ",
  "Edit User": "កែអ្នកប្រើ",
  "Active": "សកម្ម",
  "Inactive": "អសកម្ម",
  "New Password (Optional)": "ពាក្យសម្ងាត់ថ្មី (ជាជម្រើស)",
  "Save Changes": "រក្សាទុកការកែប្រែ",
  "AI Forecast Console": "ផ្ទាំងព្យាករណ៍ AI",
  "Moving-average forecast and reorder recommendations.": "ព្យាករណ៍ moving-average និងការណែនាំបញ្ជាទិញឡើងវិញ។",
  "Product Forecast": "ព្យាករណ៍ផលិតផល",
  "Days": "ថ្ងៃ",
  "Lead Time": "រយៈពេលដឹកនាំ",
  "Run Forecast": "ដំណើរការព្យាករណ៍",
  "Reorder Recommendations": "ការណែនាំបញ្ជាទិញឡើងវិញ",
  "Load Recommendations": "ផ្ទុកការណែនាំ",
  "Avg/Day": "មធ្យម/ថ្ងៃ",
  "Lead": "Lead",
  "Reorder": "បញ្ជាទិញឡើងវិញ",
  "Stock": "ស្តុក",
  "Suggest Qty": "ចំនួនណែនាំ",
  "Search category": "ស្វែងរកប្រភេទ",
  "name or email": "ឈ្មោះ ឬអ៊ីមែល",
  "Search by name or barcode": "ស្វែងរកតាមឈ្មោះ ឬបាកូដ",
  "Scan or type barcode": "ស្កេន ឬវាយបាកូដ",
  "Example: New stock arrived / Stock count correction": "ឧទាហរណ៍៖ ស្តុកថ្មីមកដល់ / កែតម្រូវចំនួនស្តុក",
  "leave empty to sender email": "ទុកទទេដើម្បីប្រើអ៊ីមែលអ្នកផ្ញើ",
  "Leave blank to keep current password": "ទុកទទេដើម្បីរក្សាពាក្យសម្ងាត់ចាស់"
  ,
  "Only ADMIN can manage categories.": "មានតែ ADMIN ប៉ុណ្ណោះដែលអាចគ្រប់គ្រងប្រភេទ។",
  "Only ADMIN can save categories.": "មានតែ ADMIN ប៉ុណ្ណោះដែលអាចរក្សាទុកប្រភេទ។",
  "Only ADMIN can access Email Settings.": "មានតែ ADMIN ប៉ុណ្ណោះដែលអាចចូលប្រើការកំណត់អ៊ីមែល។",
  "Only ADMIN can adjust stock quantities.": "មានតែ ADMIN ប៉ុណ្ណោះដែលអាចកែប្រែបរិមាណស្តុក។",
  "You do not have permission to access user management.": "អ្នកមិនមានសិទ្ធិចូលប្រើការគ្រប់គ្រងអ្នកប្រើ។",
  "No system roles found": "មិនមានតួនាទីប្រព័ន្ធទេ",
  "Role Name": "ឈ្មោះតួនាទី",
  "Permissions": "សិទ្ធិ",
  "Save Permissions": "រក្សាទុកសិទ្ធិ",
  "User not found in current list.": "រកមិនឃើញអ្នកប្រើនៅក្នុងបញ្ជីបច្ចុប្បន្ន។",
  "User created.": "បង្កើតអ្នកប្រើបានជោគជ័យ។",
  "User deleted.": "លុបអ្នកប្រើបានជោគជ័យ។",
  "User updated.": "កែប្រែអ្នកប្រើបានជោគជ័យ។",
  "No changes to update.": "មិនមានទិន្នន័យត្រូវកែប្រែទេ។",
  "Role permissions updated.": "បានកែប្រែសិទ្ធិតួនាទី។",
  "Delete category": "លុបប្រភេទ",
  "Delete product": "លុបផលិតផល",
  "Delete user": "លុបអ្នកប្រើ",
  "Void sale": "លុបសុពលភាពការលក់",
  "Update Category": "កែប្រែប្រភេទ",
  "Category updated.": "កែប្រែប្រភេទបានជោគជ័យ។",
  "Category created.": "បង្កើតប្រភេទបានជោគជ័យ។",
  "Enter category name:": "បញ្ចូលឈ្មោះប្រភេទ៖",
  "No category found. Create one first:": "រកមិនឃើញប្រភេទទេ។ សូមបង្កើតមួយជាមុន៖",
  "No category found. Please ask Admin to create categories first.": "រកមិនឃើញប្រភេទទេ។ សូមស្នើសុំ Admin បង្កើតប្រភេទជាមុន។",
  "No categories yet": "មិនទាន់មានប្រភេទ",
  "Failed to load categories": "ផ្ទុកប្រភេទបរាជ័យ",
  "Current Stock": "ស្តុកបច្ចុប្បន្ន",
  "Please enter or scan barcode first.": "សូមបញ្ចូល ឬស្កេនបាកូដជាមុនសិន។",
  "Product found. Ready to update stock.": "រកឃើញផលិតផល ហើយរួចរាល់សម្រាប់កែស្តុក។",
  "Please create at least one category before saving a product.": "សូមបង្កើតប្រភេទយ៉ាងតិចមួយ មុនពេលរក្សាទុកផលិតផល។",
  "Product created.": "បង្កើតផលិតផលបានជោគជ័យ។",
  "Please find a valid product by barcode first.": "សូមស្វែងរកផលិតផលត្រឹមត្រូវតាមបាកូដជាមុនសិន។",
  "Stock updated successfully.": "ធ្វើបច្ចុប្បន្នភាពស្តុកបានជោគជ័យ។",
  "Barcode detected and filled.": "បានរកឃើញបាកូដ និងបំពេញដោយស្វ័យប្រវត្តិ។",
  "Barcode detected.": "បានរកឃើញបាកូដ។",
  "Scanner failed to read. Try better lighting.": "ស្កេនមិនអាចអានបាន។ សូមសាកល្បងពន្លឺល្អជាងនេះ។",
  "Scanner could not read barcode. Try better lighting.": "ស្កេនមិនអាចអានបាកូដបាន។ សូមសាកល្បងពន្លឺល្អជាងនេះ។",
  "Camera scanning is not supported in this browser. You can still type barcode manually or use a USB scanner.": "Browser នេះមិនគាំទ្រការស្កេនកាមេរ៉ាទេ។ អ្នកអាចវាយបាកូដដោយដៃ ឬប្រើ USB scanner។",
  "Point your camera at a barcode to auto-fill the selected field.": "ដាក់កាមេរ៉ាទៅបាកូដ ដើម្បីបំពេញវាលដែលបានជ្រើសដោយស្វ័យប្រវត្តិ។",
  "Point your camera at a barcode to auto-fill sale barcode field.": "ដាក់កាមេរ៉ាទៅបាកូដ ដើម្បីបំពេញវាលបាកូដសម្រាប់លក់ដោយស្វ័យប្រវត្តិ។",
  "Sales trend chart": "ក្រាហ្វនិន្នាការលក់",
  "Email settings saved.": "រក្សាទុកការកំណត់អ៊ីមែលបានជោគជ័យ។",
  "Test sent. Message ID:": "បានផ្ញើសាកល្បង។ លេខសារ៖",
  "Estimated Total": "សរុបប៉ាន់ស្មាន",
  "Unit Price": "តម្លៃឯកតា",
  "Sale ID": "លេខការលក់",
  "Total": "សរុប",
  "Items": "ទំនិញ",
  "Line Total": "សរុបក្នុងបន្ទាត់",
  "No items": "គ្មានទំនិញ",
  "Payments": "ការទូទាត់",
  "Method": "វិធីសាស្ត្រ",
  "Amount": "ចំនួនប្រាក់",
  "Paid At": "បានបង់នៅ",
  "No payments": "គ្មានការទូទាត់",
  "Sale created successfully.": "បង្កើតការលក់បានជោគជ័យ។",
  "Txns": "ប្រតិបត្តិការ"
};

function getLanguage() {
  const raw = (safeGet(LANG_KEY) || "en").toLowerCase();
  return SUPPORTED_LANGS.includes(raw) ? raw : "en";
}

function setLanguage(lang) {
  const nextLang = String(lang || "").toLowerCase();
  if (!SUPPORTED_LANGS.includes(nextLang)) return;
  safeSet(LANG_KEY, nextLang);
  window.location.reload();
}

function t(text) {
  const normalized = String(text ?? "");
  if (getLanguage() !== "km") return normalized;
  return KM_TEXT_MAP[normalized] || normalized;
}

function getToken() {
  return safeGet("token") || "";
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUser() {
  const raw = safeGet("user");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      safeRemove("user");
    }
  }

  const token = getToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const recoveredUser = {
    user_id: payload.user_id || payload.sub || 0,
    full_name: payload.full_name || payload.name || "User",
    role: payload.role || "STAFF",
    role_name: payload.role_name || payload.role || "STAFF",
    permissions: Array.isArray(payload.permissions) ? payload.permissions : []
  };

  safeSet("user", JSON.stringify(recoveredUser));
  return recoveredUser;
}

function clearAuth() {
  safeRemove("token");
  safeRemove("user");
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStore[key] || null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStore[key] = String(value);
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    delete memoryStore[key];
  }
}

function logout() {
  clearAuth();
  location.href = "/login.html";
}

function requireAuth() {
  if (!getToken()) location.href = "/login.html";
}

function isAdmin() {
  return getUser()?.role === "ADMIN";
}

function hasPermission(permissionKey) {
  const user = getUser();
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (permissions.length === 0) return true;
  return permissions.includes(permissionKey);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const isLoginRequest = path === "/auth/login";

  if (!token && !isLoginRequest) {
    if (location.pathname !== "/login.html") {
      location.href = "/login.html";
    }

    const error = new Error("Unauthorized");
    error.status = 401;
    error.code = "UNAUTHORIZED";
    throw error;
  }

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;
    error.code = data?.error_code;

    const isTokenError =
      response.status === 401 &&
      (data?.error_code === "INVALID_TOKEN" || data?.error_code === "UNAUTHORIZED");

    if (!isLoginRequest && isTokenError) {
      clearAuth();
      if (location.pathname !== "/login.html") {
        location.href = "/login.html?reason=session_expired";
      }
    }

    throw error;
  }

  return data;
}

function renderNav(active) {
  activeNavId = active;
  const user = getUser();
  const nav = document.getElementById("app-nav");
  if (!nav || !user) return;
  document.body.classList.add("has-app-nav");
  const lang = getLanguage();

  const sections = [
    {
      label: t("Overview"),
      links: [
        { id: "dashboard", href: "/dashboard.html", label: t("Dashboard"), permission: "dashboard.view" }
      ]
    },
    {
      label: t("Operations"),
      links: [
        { id: "users", href: "/users.html", label: t("Users"), permission: "users.manage" },
        { id: "categories", href: "/categories.html", label: t("Categories"), permission: "categories.manage" },
        { id: "products", href: "/products.html", label: t("Products"), permission: "products.view" },
        { id: "sales", href: "/sales.html", label: t("Sales"), permission: "sales.create" }
      ]
    },
    {
      label: t("Insights"),
      links: [
        { id: "reports", href: "/reports.html", label: t("Reports"), permission: "reports.view" },
        { id: "ai", href: "/ai.html", label: t("AI Forecast"), permission: "ai.view" },
        { id: "inventory-health", href: "/inventory-health.html", label: t("Inventory Health"), permission: "reports.view" }
      ]
    },
    {
      label: t("Settings"),
      links: [
        { id: "email", href: "/email-settings.html", label: t("Email Alerts"), permission: "email.manage" }
      ]
    }
  ];

  const sectionHtml = sections
    .map((section) => {
      const visibleLinks = section.links.filter((item) => hasPermission(item.permission));
      const links = (visibleLinks.length ? visibleLinks : section.links)
        .map((item) => `<a href="${item.href}" class="${active === item.id ? "active" : ""}" data-nav-link>${item.label}</a>`)
        .join("");

      if (!links) return "";
      return `
        <div class="sidebar-section">
          <div class="sidebar-label">${section.label}</div>
          <div class="sidebar-links">${links}</div>
        </div>
      `;
    })
    .join("");

  nav.innerHTML = `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-brand">
        <span class="brand-dot"></span>
        <strong>${t("AI Inventory System")}</strong>
      </div>
      ${sectionHtml}
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-user-name">${user.full_name}</div>
          <div class="sidebar-user-role">${user.role_name || user.role}</div>
        </div>
        <button id="logoutBtn" class="secondary" type="button">${t("Logout")}</button>
      </div>
    </aside>

    <div class="app-overlay" id="appOverlay"></div>

    <header class="app-topbar">
      <button id="navToggle" class="nav-toggle" type="button">${t("Menu")}</button>
      <div class="topbar-title">${t("AI Inventory System")}</div>
      <div class="lang-switch">
        <button type="button" class="btn-inline ${lang === "en" ? "active" : ""}" data-lang-switch="en">EN</button>
        <button type="button" class="btn-inline ${lang === "km" ? "active" : ""}" data-lang-switch="km">ខ្មែរ</button>
      </div>
    </header>
  `;

  const closeSidebar = () => document.body.classList.remove("sidebar-open");
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("navToggle")?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });
  nav.querySelectorAll("[data-lang-switch]").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.getAttribute("data-lang-switch")));
  });
  document.getElementById("appOverlay")?.addEventListener("click", closeSidebar);
  nav.querySelectorAll("[data-nav-link]").forEach((link) => link.addEventListener("click", closeSidebar));
}

function translateElementText(root = document) {
  if (isApplyingI18n) return;
  isApplyingI18n = true;
  try {
    const lang = getLanguage();
    document.documentElement.setAttribute("lang", lang === "km" ? "km" : "en");

    const textNodes = root.querySelectorAll("h1,h2,h3,h4,p,label,button,th,option,a,.kpi-label,.chip,.sidebar-label,.topbar-title");
    textNodes.forEach((el) => {
      const current = (el.textContent || "").trim();
      if (!current) return;
      if (!el.dataset.i18nSource) {
        el.dataset.i18nSource = current;
      }
      const source = el.dataset.i18nSource;
      const nextText = lang === "km" ? t(source) : source;
      if ((el.textContent || "") !== nextText) {
        el.textContent = nextText;
      }
    });

    root.querySelectorAll("input[placeholder]").forEach((el) => {
      if (!el.dataset.i18nPlaceholder) {
        el.dataset.i18nPlaceholder = el.getAttribute("placeholder");
      }
      const source = el.dataset.i18nPlaceholder || "";
      const nextPlaceholder = lang === "km" ? t(source) : source;
      if ((el.getAttribute("placeholder") || "") !== nextPlaceholder) {
        el.setAttribute("placeholder", nextPlaceholder);
      }
    });
  } finally {
    isApplyingI18n = false;
  }
}

function setupI18nObserver() {
  if (i18nObserver) return;
  i18nObserver = new MutationObserver((mutations) => {
    if (isApplyingI18n) return;
    const hasNewNodes = mutations.some((m) => m.addedNodes && m.addedNodes.length > 0);
    if (!hasNewNodes) return;
    translateElementText(document);
  });
  i18nObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    translateElementText(document);
    setupI18nObserver();
  });
} else {
  translateElementText(document);
  setupI18nObserver();
}

window.App = {
  apiFetch,
  requireAuth,
  renderNav,
  getUser,
  logout,
  clearAuth,
  isAdmin,
  hasPermission,
  getLanguage,
  setLanguage,
  t,
  applyI18n: translateElementText
};
