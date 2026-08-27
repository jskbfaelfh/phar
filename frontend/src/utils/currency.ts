/**
 * Iraqi Dinar Currency Utility (قاعدة الـ 250 دينار عراقي)
 * في العراق، أقل فئة نقدية متداولة هي 250 دينار (ربع ألف).
 * أي مبلغ يدخل أو يخرج أو يتم تسعيره يكون بحد أدنى 250 د.ع وبمضاعفات الـ 250 دينار.
 */

export const MIN_IQD_UNIT = 250;

/**
 * تقريب أي مبلغ لأقرب مضاعف لـ 250 دينار (مع ضمان حد أدنى 250 إذا كان المبلغ موجباً)
 */
export const roundTo250 = (amount: number): number => {
  if (!amount || amount <= 0) return 0;
  return Math.max(MIN_IQD_UNIT, Math.round(amount / MIN_IQD_UNIT) * MIN_IQD_UNIT);
};

/**
 * حساب سعر بيع الشريط تلقائياً من سعر العلبة مع التقريب لمضاعفات 250 د.ع
 */
export const calculateStripPrice = (packPrice: number, unitsPerPack: number): number => {
  if (!packPrice || packPrice <= 0 || !unitsPerPack || unitsPerPack <= 0) return 0;
  return Math.max(MIN_IQD_UNIT, Math.round(packPrice / unitsPerPack / MIN_IQD_UNIT) * MIN_IQD_UNIT);
};

/**
 * تنسيق المبلغ بالدينار العراقي
 */
export const formatIQD = (amount: number): string => {
  return `${Number(amount || 0).toLocaleString()} د.ع`;
};
