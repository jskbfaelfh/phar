import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { decryptSecret } from '../../common/utils/security.util';

export interface ScannedInvoiceItem {
  rawName: string;
  matchedMedicineId: string | null;
  matchedTradeName: string;
  scientificName?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  barcode?: string;
  batchNumber?: string;
  expiryDate: string;
  quantityPacks: number;
  bonusQuantity: number;
  unitsPerPack: number;
  purchasePricePack: number;
  lastPurchasePricePack?: number;
  discountPercent: number;
  sellingPricePack: number;
  sellingPriceUnit?: number;
  shelfLocation?: string;
  totalCost: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  discrepancies: string[];
}

export interface DiscountTier {
  monthIndex: number;
  daysLimit: number;
  discountPercent: number;
}

export interface ScannedInvoiceResult {
  invoiceNumber?: string | null;
  supplierName: string;
  invoiceDate: string;
  totalAmount: number;
  directDiscountAmount?: number | null;
  earlyDiscountDays?: number | null;
  earlyDiscountPercent?: number | null;
  discountMonths?: number | null;
  discountTiers?: DiscountTier[];
  confidenceScore: number;
  items: ScannedInvoiceItem[];
  discrepanciesCount: number;
  rawExtractedText?: string;
}

/**
 * Helper to ensure tradeName is strictly [Trade Name] + [Strength]
 * Completely removes dosage forms (tab, cap, syrup, etc.) and pack/company noise
 */
function cleanTradeNameWithStrength(rawName: string, strengthProvided?: string): { cleanName: string; cleanStrength: string } {
  let text = String(rawName || '').replace(/[\*\#\_]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract strength if not provided
  const strengthRegex = /(\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|%|iu|IU|u|U)(?:\/\d+(?:\.\d+)?\s*(?:ml|mg))?\b|\b\d+\/\d+\s*mg\b|\b\d+\/\d+\b)/i;
  let strength = strengthProvided?.trim() || '';
  if (!strength) {
    const sm = text.match(strengthRegex);
    if (sm) {
      strength = sm[1].trim();
    }
  }

  // Remove strength temporarily from text to clean base name
  let base = text;
  if (strength) {
    base = base.replace(new RegExp(strength.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  }

  // Strip dosage forms strictly
  const formPatterns = [
    /\b(?:tabs?|tablets?|taps?|compresse?s?|comprim[eé]s?|أقراص|حبوب)\b/gi,
    /\b(?:caps?|capsules?|كبسول)\b/gi,
    /\b(?:syrups?|syr|شراب)\b/gi,
    /\b(?:susp(?:ension)?|معلق)\b/gi,
    /\b(?:inj(?:ection)?|amp(?:oule)?s?|vials?|حقن|امبول|فيال)\b/gi,
    /\b(?:drops?|eye drops?|ear drops?|قطرة|قطرات)\b/gi,
    /\b(?:creams?|cr|كريم)\b/gi,
    /\b(?:ointments?|oint|مرهم)\b/gi,
    /\b(?:gels?|جل)\b/gi,
    /\b(?:supp(?:ositor(?:y|ies))?|تحاميل)\b/gi,
    /\b(?:sprays?|بخاخ)\b/gi,
    /\b(?:infusions?|i\.v\.|iv|محلول وريدي|محلول)\b/gi,
    /\b(?:lotions?|لوشن)\b/gi,
    /\b(?:mouthwash|غسول)\b/gi,
    /\b(?:powders?|بودرة|ساشيت|sachets?)\b/gi,
  ];

  for (const fp of formPatterns) {
    base = base.replace(fp, ' ');
  }

  // Strip pack/bonus/packaging noise & common pharmaceutical companies
  base = base.replace(/\b\d+\s*(?:tabs?|caps?|amp(?:oule)?s?|vials?|ml|s)\b/gi, ' ');
  base = base.replace(/\b\d+(?:tabs?|caps?|amp(?:oule)?s?|vials?|ml)\b/gi, ' ');
  base = base.replace(/\b(?:باكيت|شريط|علبة|قطعة|box|strip|pack|free|bonus|هدية|orginal|original)\b/gi, ' ');
  base = base.replace(/\b(?:sanofi|merck|accord|astrazeneca|novartis|pfizer|gula|sdi|hikma|julphar|dar al dawa|awamedica|acino|glaxo|gsk|bayer|roche)\b/gi, ' ');
  base = base.replace(/[\(\)\[\]\-\+\:\;]+/g, ' ');
  base = base.replace(/\s+/g, ' ').trim();

  // Re-assemble strictly: [Clean Name] [Strength]
  const finalTradeName = strength ? `${base} ${strength}`.trim() : base.trim();
  return {
    cleanName: finalTradeName || text,
    cleanStrength: strength,
  };
}

@Injectable()
export class OcrAiService {
  private readonly logger = new Logger(OcrAiService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process invoice image with real AI Vision & Match against Master Drug Database
   */
  async processInvoiceImage(
    tenantId: string,
    imageBase64: string,
    skipMatching = false,
  ): Promise<ScannedInvoiceResult> {
    this.logger.log(`Processing real AI OCR for tenant: ${tenantId} (skipMatching: ${skipMatching})`);

    // 1. Check Pharmacy-specific Gemini API Key
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { geminiApiKey: true, name: true, schemaName: true },
    });

    let rawKey = tenant?.geminiApiKey?.trim();
    if (rawKey) {
      try {
        rawKey = decryptSecret(rawKey);
      } catch {
        // Fallback to existing
      }
    }
    const apiKey = rawKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new BadRequestException(
        'ميزة القراءة الذكية غير مفعلة. يرجى التوجه إلى "إعدادات الصيدلية" وإضافة مفتاح (Google Gemini API Key) لتفعيل قراءة الفواتير بالذكاء الاصطناعي.',
      );
    }

    if (!imageBase64 || imageBase64.length < 50) {
      throw new BadRequestException('يرجى التقاط أو رفع صورة واضحة لفاتورة المذخر.');
    }

    // Maximum Decoded Image Size: 10 MB
    const MAX_DECODED_BYTES = 10 * 1024 * 1024;
    const rawBase64 = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1].trim() : imageBase64.trim();
    const estimatedBytes = Math.ceil((rawBase64.length * 3) / 4);
    if (estimatedBytes > MAX_DECODED_BYTES * 1.05) {
      throw new BadRequestException(
        `حجم صورة الفاتورة بعد فك الترميز (${(estimatedBytes / (1024 * 1024)).toFixed(2)} ميغابايت) يتجاوز الحد الأقصى المسموح به للذكاء الاصطناعي (10 ميغابايت).`,
      );
    }

    // 2. Call Google Gemini Vision AI directly
    let aiParsedData: any;
    try {
      aiParsedData = await this.callGeminiVision(apiKey, imageBase64);
    } catch (err: any) {
      this.logger.error(`Gemini Vision API error: ${err.message}`);
      throw new BadRequestException(
        `تعذر تحليل الفاتورة بواسطة الذكاء الاصطناعي: ${err.message || 'تأكد من صحة رمز الـ API ووضوح صورة الفاتورة.'}`,
      );
    }

    if (!aiParsedData || !Array.isArray(aiParsedData.items) || aiParsedData.items.length === 0) {
      throw new BadRequestException(
        'لم يتمكن الذكاء الاصطناعي من العثور على أدوية أو بنود واضحة داخل الصورة. يرجى التأكد من إضاءة الصورة ووضوح جدول الأدوية.',
      );
    }

    // 3. Match each extracted medicine against Master Drug Database
    const matchedItems: ScannedInvoiceItem[] = [];
    let discrepanciesCount = 0;

    for (const item of aiParsedData.items) {
      const rawName = String(item.rawName || item.tradeName || '').trim();

      let matchedMedicineId: string | null = null;
      let matchedTradeName = rawName || 'دواء جديد';
      let scientificName: string = item.scientificName ? String(item.scientificName).trim() : '';
      let barcode: string = item.barcode ? String(item.barcode).trim() : '';
      let matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
      let existingBatch: any = null;
      let existingItem: any = null;
      let shelfLocation = '';

      // 1. Quantity & Purchase Price
      let quantityPacks = Number(item.quantityPacks || 1);
      const bonusQuantity = Number(item.bonusQuantity || 0);
      const discountPercent = Number(item.discountPercent || 0);
      const purchasePrice = Number(item.purchasePricePack || 0);
      const isCanceled = Boolean(item.isCanceled || item.canceled || quantityPacks === 0);
      if (isCanceled) {
        quantityPacks = 0;
      }

      // 2. Handwritten Selling Price Normalization (e.g. 30 -> 30000, 6.5 -> 6500 for IQD)
      let sellingPrice = Number(item.sellingPricePack || 0);
      if (sellingPrice > 0 && sellingPrice < 500 && purchasePrice >= 1000) {
        sellingPrice = Math.round(sellingPrice * 1000);
      }

      const discrepancies: string[] = [];
      if (isCanceled) {
        discrepancies.push('🚫 مادة مشطوبة / ملغاة بإشارة (X) في الفاتورة');
      }

      // 3. Iraqi Handwritten Expiry Date Parser (YY/MM, MM/YY, YYYY/MM)
      let expiryDate = '';
      if (item.expiryDate && item.expiryDate !== 'N/A' && item.expiryDate !== 'null') {
        let rawExp = String(item.expiryDate).trim().replace(/[\/\.]/g, '-');
        const parts = rawExp.split('-');
        if (parts.length === 2) {
          let p1 = parseInt(parts[0], 10);
          let p2 = parseInt(parts[1], 10);
          if (p1 > 2000 && p2 >= 1 && p2 <= 12) {
            rawExp = `${p1}-${String(p2).padStart(2, '0')}-01`;
          } else if (p1 >= 24 && p1 <= 40 && p2 >= 1 && p2 <= 12) {
            // Format: YY-MM (e.g. 29-9 -> 2029-09-01)
            rawExp = `20${p1}-${String(p2).padStart(2, '0')}-01`;
          } else if (p2 >= 24 && p2 <= 40 && p1 >= 1 && p1 <= 12) {
            // Format: MM-YY (e.g. 7-28 -> 2028-07-01)
            rawExp = `20${p2}-${String(p1).padStart(2, '0')}-01`;
          } else if (p2 > 2000 && p1 >= 1 && p1 <= 12) {
            // Format: MM-YYYY
            rawExp = `${p2}-${String(p1).padStart(2, '0')}-01`;
          }
        } else if (parts.length === 3 && parseInt(parts[0], 10) < 100) {
          let y = parseInt(parts[0], 10);
          if (y >= 24 && y <= 40) {
            rawExp = `20${y}-${parts[1]}-${parts[2]}`;
          }
        }
        expiryDate = rawExp;
        const exp = new Date(expiryDate);
        const now = new Date();
        const sixMonths = new Date();
        sixMonths.setMonth(now.getMonth() + 6);

        if (!isNaN(exp.getTime())) {
          if (exp < now) {
            discrepancies.push('⚠️ تنبيه: تاريخ الصلاحية منتهي!');
          } else if (exp < sixMonths) {
            discrepancies.push('⚠️ تنبيه: الصلاحية قريبة (أقل من 6 أشهر)');
          }
        }
      }

      const batchNumber = item.batchNumber && item.batchNumber !== 'N/A' && item.batchNumber !== 'null'
        ? String(item.batchNumber).trim()
        : '';

      if (!skipMatching) {
        // Mode 1: Match against Master Drug Database & Previous Pharmacy Inventory
        const { cleanName, cleanStrength } = cleanTradeNameWithStrength(
          item.tradeName || rawName,
          item.strength,
        );
        const matchResult = await this.matchMedicineInMasterDb(cleanName, barcode || undefined);
        matchedMedicineId = matchResult.medicine?.id || null;
        matchedTradeName = matchResult.medicine?.tradeName
          ? cleanTradeNameWithStrength(matchResult.medicine.tradeName, cleanStrength).cleanName
          : cleanName;
        scientificName = matchResult.scientificName || scientificName;
        barcode = matchResult.barcode || barcode;
        matchConfidence = matchResult.confidence;

        if (matchResult.confidence === 'LOW') {
          discrepancies.push('💡 صنف جديد في مخزنك - سيتم إدراجه وتفعيل بيعه');
        } else if (matchResult.confidence === 'MEDIUM') {
          discrepancies.push(`💡 تم مطابقة الصنف مع: ${matchResult.tradeName}`);
        }

        // Fetch last known history from the pharmacy's inventory for this item by barcode / medicine_id / name
        const effectiveBarcode = matchResult.barcode || barcode;
        const effectiveMedId = matchResult.medicine?.id;

        try {
          if (tenant?.schemaName) {
            const schema = tenant.schemaName;
            let itemSql = `
              SELECT ii.id, ii.custom_name as "customName", ii.units_per_pack as "unitsPerPack",
                     ii.selling_price_pack as "sellingPricePack", ii.selling_price_unit as "sellingPriceUnit",
                     ii.shelf_location as "shelfLocation"
              FROM "${schema}".inventory_items ii
              LEFT JOIN public.medicines m ON ii.medicine_id = m.id
              WHERE 1=0
            `;
            const itemParams: any[] = [];
            if (effectiveBarcode && effectiveBarcode.length > 3) {
              itemParams.push(effectiveBarcode);
              itemSql += ` OR m.barcode = $${itemParams.length}`;
            }
            if (effectiveMedId) {
              itemParams.push(effectiveMedId);
              itemSql += ` OR ii.medicine_id = $${itemParams.length}::uuid`;
            }
            if (cleanName && cleanName.length > 2) {
              itemParams.push(`%${cleanName}%`);
              itemSql += ` OR m.trade_name ILIKE $${itemParams.length} OR ii.custom_name ILIKE $${itemParams.length}`;
            }
            itemSql += ` ORDER BY ii.updated_at DESC LIMIT 1`;

            if (itemParams.length > 0) {
              const foundItems: any[] = await this.prisma.$queryRawUnsafe(itemSql, ...itemParams);
              if (foundItems.length > 0) {
                existingItem = foundItems[0];

                const foundBatches: any[] = await this.prisma.$queryRawUnsafe(
                  `SELECT batch_number as "batchNumber",
                          TO_CHAR(expiry_date, 'YYYY-MM-DD') as "expiryDate",
                          purchase_price_pack as "purchasePricePack",
                          selling_price_pack as "sellingPricePack",
                          selling_price_unit as "sellingPriceUnit"
                   FROM "${schema}".inventory_batches
                   WHERE inventory_item_id = $1::uuid
                   ORDER BY created_at DESC
                   LIMIT 1`,
                  existingItem.id,
                );
                if (foundBatches.length > 0) {
                  existingBatch = foundBatches[0];
                }
              }
            }
          }
        } catch (err: any) {
          this.logger.warn(`Could not lookup existing inventory history in OCR: ${err.message}`);
        }
      } else {
        // Mode 2: Direct Raw Mode (No Catalog Matching) - Extract raw printed text ONLY, non-printed fields remain strictly EMPTY!
        discrepancies.push('⚡ مسح مباشر بدون مطابقة - تم استخراج النص المطبوع بالفاتورة فقط');
      }

      if (bonusQuantity > 0) {
        discrepancies.push(`🎁 يشتمل على بونص مجاني (${bonusQuantity} علب هدايا)`);
      }

      // 1. Units per pack: take from pharmacy's existing inventory first if not skipMatching
      const units = Number(
        (!skipMatching && existingItem?.unitsPerPack) || item.unitsPerPack || 1,
      );

      // 2. Selling Price: if invoice has no retail selling price and NOT skipMatching, autofill from pharmacy's existing record
      let finalSellingPrice = sellingPrice;
      if (finalSellingPrice <= 0 && !skipMatching) {
        finalSellingPrice = Number(
          existingItem?.sellingPricePack || existingBatch?.sellingPricePack || 0,
        );
      }

      // Selling Price Unit
      let unitPrice = Number(item.sellingPriceUnit || 0);
      if (unitPrice <= 0 && !skipMatching) {
        unitPrice = Number(
          existingItem?.sellingPriceUnit || existingBatch?.sellingPriceUnit || 0,
        );
      }
      if (unitPrice <= 0 && finalSellingPrice > 0 && units > 0) {
        unitPrice = Math.round(finalSellingPrice / units);
      }

      // 3. Shelf Location: autofill from existing inventory ONLY if not skipMatching
      if (!skipMatching && existingItem?.shelfLocation) {
        shelfLocation = String(existingItem.shelfLocation).trim();
      }

      if (!expiryDate) {
        discrepancies.push('⚠️ الصلاحية غير محددة في الفاتورة - يرجى إدخال تاريخ الصلاحية يدوياً من العبوة لضمان سلامة المرضى');
      }

      if (!skipMatching && existingItem) {
        const prefilledNotes: string[] = [];
        if (finalSellingPrice > 0) prefilledNotes.push(`السعر: ${finalSellingPrice.toLocaleString()} د.ع`);
        if (shelfLocation) prefilledNotes.push(`الرف: ${shelfLocation}`);
        if (units > 1) prefilledNotes.push(`العلبة: ${units} شريط`);
        if (prefilledNotes.length > 0) {
          discrepancies.push(`📦 تم جلب البيانات تلقائياً من مخزنك السابق (${prefilledNotes.join(' | ')})`);
        }
      }

      if (discrepancies.length > 0) {
        discrepanciesCount += discrepancies.length;
      }

      matchedItems.push({
        rawName,
        matchedMedicineId,
        matchedTradeName: matchedTradeName || rawName,
        scientificName: scientificName || item.scientificName || '',
        strength: item.strength || '',
        dosageForm: item.dosageForm || '',
        manufacturer: item.manufacturer || '',
        barcode: barcode || '',
        batchNumber,
        expiryDate,
        quantityPacks,
        bonusQuantity,
        unitsPerPack: units,
        purchasePricePack: purchasePrice,
        lastPurchasePricePack: Number(existingBatch?.purchasePricePack || 0),
        discountPercent,
        sellingPricePack: finalSellingPrice,
        sellingPriceUnit: unitPrice,
        shelfLocation,
        totalCost: quantityPacks * (purchasePrice * (1 - discountPercent / 100)),
        confidence: matchConfidence as any,
        discrepancies,
      });
    }

    const calculatedTotal = matchedItems.reduce((acc, it) => acc + it.totalCost, 0);

    // Parse Tiered Monthly Payment Discounts
    let discountTiers: DiscountTier[] = [];
    if (Array.isArray(aiParsedData.discountTiers) && aiParsedData.discountTiers.length > 0) {
      discountTiers = aiParsedData.discountTiers.map((t: any, idx: number) => ({
        monthIndex: Number(t.monthIndex) || (idx + 1),
        daysLimit: Number(t.daysLimit) || ((idx + 1) * 30),
        discountPercent: Number(t.discountPercent) || 0,
      }));
    } else if (aiParsedData.earlyDiscountPercent && Number(aiParsedData.earlyDiscountPercent) > 0) {
      const days = Number(aiParsedData.earlyDiscountDays) || 30;
      discountTiers = [
        {
          monthIndex: Math.ceil(days / 30) || 1,
          daysLimit: days,
          discountPercent: Number(aiParsedData.earlyDiscountPercent),
        },
      ];
    }

    return {
      invoiceNumber: aiParsedData.invoiceNumber ? String(aiParsedData.invoiceNumber).trim() : null,
      supplierName: aiParsedData.supplierName ? String(aiParsedData.supplierName) : 'مذخر أدوية',
      invoiceDate: aiParsedData.invoiceDate ? String(aiParsedData.invoiceDate) : new Date().toISOString().slice(0, 10),
      totalAmount: Number(aiParsedData.totalAmount) || calculatedTotal,
      directDiscountAmount: Number(aiParsedData.directDiscountAmount) || 0,
      earlyDiscountDays: discountTiers.length > 0 ? discountTiers[0].daysLimit : null,
      earlyDiscountPercent: discountTiers.length > 0 ? discountTiers[0].discountPercent : null,
      discountMonths: discountTiers.length > 0 ? discountTiers.length : null,
      discountTiers,
      confidenceScore: Math.max(70, 100 - discrepanciesCount * 4),
      items: matchedItems,
      discrepanciesCount,
      rawExtractedText: aiParsedData.rawExtractedText || '',
    };
  }

  /**
   * Search Master Database for matching medicine (Exact + Prefix + Fuzzy Search)
   */
  private async matchMedicineInMasterDb(
    rawName: string,
    barcode?: string,
  ): Promise<{
    medicine: any | null;
    tradeName: string;
    scientificName?: string;
    barcode?: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  }> {
    if (!rawName && !barcode) {
      return { medicine: null, tradeName: 'دواء غير محدد', confidence: 'LOW' };
    }

    // 1. Match by Barcode if provided
    if (barcode && barcode.trim().length > 4) {
      const byBarcode: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT id, trade_name as "tradeName", scientific_name as "scientificName", barcode, 
               default_units_per_pack as "unitsPerPack", strength, dosage_form as "dosageForm", manufacturer
        FROM public.medicines
        WHERE barcode = $1 LIMIT 1;
      `, barcode.trim());

      if (byBarcode.length > 0) {
        return {
          medicine: byBarcode[0],
          tradeName: byBarcode[0].tradeName,
          scientificName: byBarcode[0].scientificName,
          barcode: byBarcode[0].barcode,
          confidence: 'HIGH',
        };
      }
    }

    // Clean search term
    const cleanTerm = rawName
      .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 2. Exact match ILIKE
    const exactMatches: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, trade_name as "tradeName", scientific_name as "scientificName", barcode, 
             default_units_per_pack as "unitsPerPack", strength, dosage_form as "dosageForm", manufacturer
      FROM public.medicines
      WHERE trade_name ILIKE $1 OR trade_name ILIKE $2
      LIMIT 1;
    `, cleanTerm, `%${cleanTerm}%`);

    if (exactMatches.length > 0) {
      return {
        medicine: exactMatches[0],
        tradeName: exactMatches[0].tradeName,
        scientificName: exactMatches[0].scientificName,
        barcode: exactMatches[0].barcode,
        confidence: 'HIGH',
      };
    }

    // 3. First Word / Prefix match (e.g. "Amaryl 4mg" in "Amaryl")
    const words = cleanTerm.split(' ').filter((w) => w.length > 2);
    if (words.length > 0) {
      const prefixMatches: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT id, trade_name as "tradeName", scientific_name as "scientificName", barcode, 
               default_units_per_pack as "unitsPerPack", strength, dosage_form as "dosageForm", manufacturer
        FROM public.medicines
        WHERE trade_name ILIKE $1
        ORDER BY LENGTH(trade_name) ASC
        LIMIT 1;
      `, `%${words[0]}%`);

      if (prefixMatches.length > 0) {
        return {
          medicine: prefixMatches[0],
          tradeName: prefixMatches[0].tradeName,
          scientificName: prefixMatches[0].scientificName,
          barcode: prefixMatches[0].barcode,
          confidence: 'MEDIUM',
        };
      }
    }

    // 4. Fallback: No confident match in Master DB
    return {
      medicine: null,
      tradeName: cleanTerm,
      confidence: 'LOW',
    };
  }

  /**
   * Gemini Multimodal Vision AI Model Extractor
   */
  private async callGeminiVision(apiKey: string, imageBase64: string): Promise<any> {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `
      You are an expert pharmaceutical accountant and OCR vision scanner specializing in Iraqi pharmacy supplier invoices (فواتير مذخر الأدوية العراقية: المشارق، المتحدون، بانادول، وغيرها).
      Analyze the provided image of a wholesale pharmaceutical invoice and accurately extract structured medicine items in JSON format according to Iraqi wholesale conventions.

      CRITICAL IRAQI WHOLESALE INVOICE CONVENTIONS:
      1. "tradeName": MUST consist of (Clean Commercial Trade Name + Strength) ONLY.
         Example: "Panadol 500mg", "Augmentin 1g", "Cataflam 50mg", "Amaryl 4mg", "Ventolin 2mg", "Lipitor 20mg", "Pregaline 75mg".
         ABSOLUTELY FORBIDDEN IN "tradeName":
         - NEVER include dosage forms (Tab, Tablet, Cap, Capsule, Syrup, Syr, Susp, Suspension, Inj, Injection, Amp, Vial, Drops, Cream, Oint, Gel, Supp, Spray, حبوب, أقراص, كبسول, شراب, معلق).
         - NEVER include packaging info (*20, *30, *100, باكيت, علبة, شريط, box, pack, piece).
         - NEVER include manufacturer names (Sanofi, Merck, Accord, AstraZeneca, SDI, Gula, Pfizer, Hikma, Julphar).
         - NEVER include supplier codes or bonus text.

      2. HANDWRITTEN SELLING PRICE (سعر البيع المفرد / السعر الرسمي بخط اليد):
         - In Iraqi wholesale invoices, selling prices are frequently written in ink/pen by the pharmacist or supplier rep.
         - Look in columns like "العدد" or "السعر الرسمي" or next to the item name for handwritten numbers (e.g., pen ink).
         - Examples:
           * "٣٠" or "30" means 30,000 IQD.
           * "٦.٥" or "6.5" means 6,500 IQD.
           * "١٠٥٠٠" or "10500" means 10,500 IQD.
           * "١٧٥٠" or "1750" means 1,750 IQD.
         - Convert Arabic numerals (١، ٢، ٣...) to standard numbers.
         - If handwritten or printed selling price exists, extract into "sellingPricePack" (e.g. 30000, 6500, 10500). If none exists, return null.

      3. HANDWRITTEN & PRINTED EXPIRY DATE (تاريخ الإكسباير):
         - Look for expiry dates written in pen in the margins (especially the left or right margin) or written over/next to crossed-out printed dates.
         - Iraqi format is usually YY/MM (e.g., "29/9" = Sep 2029 -> "2029-09-01", "28/7" = Jul 2028 -> "2028-07-01") or MM/YY.
         - If a printed date is crossed out with pen and a handwritten date is written beside it, ALWAYS prefer the handwritten date.
         - Return in "YYYY-MM-01" format. If neither printed nor handwritten date exists, return null.

      4. CANCELED / OUT-OF-STOCK ITEMS (المواد المشطوبة / علامة X):
         - In Iraqi invoices, items not supplied or out of stock are crossed out with a pen line or marked with an 'X' over the row or quantity.
         - If an item is crossed out or marked with 'X', set "isCanceled": true and "quantityPacks": 0.
         - If the item is active and supplied, set "isCanceled": false.

      5. BATCH NUMBER (رقم الوجبة):
         - Return null for "batchNumber" as per system configuration.

      6. TIERED PAYMENT DISCOUNT EXTRACTION:
         - Check notes or footer for early payment terms (e.g. "سداد شهر 6%، شهرين 3%، 3 أشهر بدون خصم"):
           Extract into "discountTiers" array:
           [
             { "monthIndex": 1, "daysLimit": 30, "discountPercent": 6 },
             { "monthIndex": 2, "daysLimit": 60, "discountPercent": 3 }
           ]
           If no payment discount is mentioned, return empty array [].

      7. DIRECT OVERALL INVOICE DISCOUNT:
         - Check the invoice totals or footer for any overall direct discount (e.g. "خصم مباشر", "خصم خاص", "خصم نقدي", "تنزيلات", "Direct Discount", "Cash Discount", "Special Discount"):
           Extract into "directDiscountAmount": number (or 0 if none).

      Required Output JSON Format:
      {
        "invoiceNumber": "string",
        "supplierName": "string",
        "invoiceDate": "YYYY-MM-DD",
        "totalAmount": number,
        "directDiscountAmount": number,
        "discountTiers": [
          { "monthIndex": 1, "daysLimit": 30, "discountPercent": 6 }
        ],
        "items": [
          {
            "rawName": "string (original raw text line)",
            "tradeName": "string (Trade Name + Strength ONLY e.g. Panadol 500mg)",
            "strength": "string (e.g. 500mg)",
            "dosageForm": "string (e.g. Tab)",
            "unitsPerPack": number,
            "quantityPacks": number,
            "bonusQuantity": number,
            "purchasePricePack": number,
            "discountPercent": number,
            "sellingPricePack": number or null,
            "scientificName": "string",
            "barcode": "string or null",
            "batchNumber": null,
            "expiryDate": "YYYY-MM-DD or null",
            "isCanceled": boolean
          }
        ]
      }

      Important: Return ONLY valid JSON format. Do NOT wrap in markdown or explanations.
    `;

    // Use official active Google Gemini Vision models
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let lastError: Error | null = null;
    let quotaExceeded = false;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: 'image/jpeg',
                        data: cleanBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
          },
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const errMsg = errData?.error?.message || response.statusText;
          // Detect quota errors — no point trying other models on same key
          if (response.status === 429 || errMsg?.toLowerCase().includes('quota')) {
            quotaExceeded = true;
            lastError = new Error(`[${model}] ${errMsg}`);
            this.logger.warn(`Quota exceeded for model ${model}, trying next model...`);
            continue;
          }
          throw new Error(`[${model}] ${errMsg}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty AI response from model');

        const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJsonStr);
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`Model ${model} failed, trying next: ${err.message}`);
      }
    }

    if (quotaExceeded) {
      throw new Error(
        '⚠️ انتهت حصة استخدام الذكاء الاصطناعي المجانية لهذا الشهر. يرجى:\n' +
        '1. الانتظار حتى تجديد الحصة\n' +
        '2. أو الترقية إلى خطة مدفوعة على https://ai.google.dev\n' +
        '3. أو إدخال الفاتورة يدوياً'
      );
    }

    throw lastError || new Error('All Gemini Vision models failed to process image');
  }
}
