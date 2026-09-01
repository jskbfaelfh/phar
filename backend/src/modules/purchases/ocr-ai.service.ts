import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
  sellingPricePack: number;
  totalCost: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  discrepancies: string[];
}

export interface ScannedInvoiceResult {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  totalAmount: number;
  earlyDiscountDays?: number | null;
  earlyDiscountPercent?: number | null;
  confidenceScore: number;
  items: ScannedInvoiceItem[];
  discrepanciesCount: number;
  rawExtractedText?: string;
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
  ): Promise<ScannedInvoiceResult> {
    this.logger.log(`Processing real AI OCR for tenant: ${tenantId}`);

    // 1. Check Pharmacy-specific Gemini API Key
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { geminiApiKey: true, name: true },
    });

    const apiKey = tenant?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new BadRequestException(
        'ميزة القراءة الذكية غير مفعلة. يرجى التوجه إلى "إعدادات الصيدلية" وإضافة مفتاح (Google Gemini API Key) لتفعيل قراءة الفواتير بالذكاء الاصطناعي.',
      );
    }

    if (!imageBase64 || imageBase64.length < 50) {
      throw new BadRequestException('يرجى التقاط أو رفع صورة واضحة لفاتورة المذخر.');
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
      const rawName = String(item.rawName || '').trim();
      const extractedTradeName = String(item.tradeName || rawName).trim();
      const barcode = item.barcode ? String(item.barcode).trim() : undefined;
      const matchResult = await this.matchMedicineInMasterDb(extractedTradeName, barcode);

      const purchasePrice = Number(item.purchasePricePack || 0);
      const quantityPacks = Number(item.quantityPacks || 1);
      const bonusQuantity = Number(item.bonusQuantity || 0);
      const sellingPrice = Number(
        item.sellingPricePack ||
        (purchasePrice > 0 ? Math.round((purchasePrice * 1.25) / 250) * 250 : 0)
      );

      // Validate dates & discrepancies
      const discrepancies: string[] = [];
      let expiryDate = item.expiryDate || '';

      if (!expiryDate || expiryDate === 'N/A') {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 2);
        expiryDate = futureDate.toISOString().slice(0, 10);
        discrepancies.push('تاريخ الصلاحية غير واضح بالفاتورة، تم تقديره تلقائياً (+ سنتين)');
      } else {
        const exp = new Date(expiryDate);
        const now = new Date();
        const sixMonths = new Date();
        sixMonths.setMonth(now.getMonth() + 6);

        if (exp < now) {
          discrepancies.push('⚠️ تنبيه: تاريخ الصلاحية منتهي!');
        } else if (exp < sixMonths) {
          discrepancies.push('⚠️ تنبيه: الصلاحية قريبة (أقل من 6 أشهر)');
        }
      }

      if (matchResult.confidence === 'LOW') {
        discrepancies.push('⚠️ دواء غير مسجل بالدليل الموحد - يرجى مراجعة الاسم والجرعة');
      } else if (matchResult.confidence === 'MEDIUM') {
        discrepancies.push(`💡 تم اقتراح المطابقة مع: ${matchResult.tradeName}`);
      }

      if (bonusQuantity > 0) {
        discrepancies.push(`🎁 يشتمل على بونص مجاني (${bonusQuantity} عبوات هدايا)`);
      }

      if (discrepancies.length > 0) {
        discrepanciesCount += discrepancies.length;
      }

      matchedItems.push({
        rawName,
        matchedMedicineId: matchResult.medicine?.id || null,
        matchedTradeName: matchResult.tradeName || extractedTradeName,
        scientificName: matchResult.scientificName || item.scientificName || '',
        strength: item.strength || matchResult.medicine?.strength || '',
        dosageForm: item.dosageForm || matchResult.medicine?.dosageForm || '',
        manufacturer: item.manufacturer || matchResult.medicine?.manufacturer || '',
        barcode: matchResult.barcode || item.barcode || '',
        batchNumber: item.batchNumber ? String(item.batchNumber).trim() : `BN-${Math.floor(1000 + Math.random() * 9000)}`,
        expiryDate,
        quantityPacks,
        bonusQuantity,
        unitsPerPack: matchResult.medicine?.unitsPerPack || item.unitsPerPack || 1,
        purchasePricePack: purchasePrice,
        sellingPricePack: sellingPrice,
        totalCost: quantityPacks * purchasePrice,
        confidence: matchResult.confidence,
        discrepancies,
      });
    }

    const calculatedTotal = matchedItems.reduce((acc, it) => acc + it.totalCost, 0);

    return {
      invoiceNumber: aiParsedData.invoiceNumber ? String(aiParsedData.invoiceNumber) : `INV-${Date.now().toString().slice(-6)}`,
      supplierName: aiParsedData.supplierName ? String(aiParsedData.supplierName) : 'مذخر أدوية',
      invoiceDate: aiParsedData.invoiceDate ? String(aiParsedData.invoiceDate) : new Date().toISOString().slice(0, 10),
      totalAmount: Number(aiParsedData.totalAmount) || calculatedTotal,
      earlyDiscountDays: aiParsedData.earlyDiscountDays ? Number(aiParsedData.earlyDiscountDays) : null,
      earlyDiscountPercent: aiParsedData.earlyDiscountPercent ? Number(aiParsedData.earlyDiscountPercent) : null,
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
      You are an expert pharmaceutical accountant and OCR scanner specializing in Iraqi pharmacy supplier invoices (فواتير مذاخر الأدوية العراقية).
      Analyze the provided image of a wholesale pharmaceutical invoice and accurately extract structured medicine items in JSON format.

      CRITICAL NAME PARSING RULES:
      1. "tradeName": MUST consist of (Clean Commercial Name + Strength/Dosage) ONLY. Example: "Amaryl 4mg", "Atacand Tab 8mg", "Atacand Plus 16/12.5mg", "Concor Cor 2.5mg", "Pregaline 75mg", "Suraxim 400mg", "Rabital H 300/12.5mg".
      2. Do NOT include form words (Tab, Cap, Drop, Inj) or pack sizes (*30, *28, *6) or manufacturer names (Sanofi, Merck, Accord, AstraZeneca) or bonus text in tradeName, UNLESS the form/strength is part of the dosage definition (e.g. Amaryl 4mg).
      3. "strength": Extract dosage strength into its own separate column e.g. "4mg", "8mg", "16/12.5mg", "2.5mg", "75mg", "400mg", "300/12.5mg", "100mg/1ml".
      4. "dosageForm": Extract dosage form into its own separate column e.g. "Tab", "Cap", "Oral Drops", "Inj", "Eye Drops".
      5. "unitsPerPack": Extract number of pills/strips/ml inside each box into its own column e.g. 30 for *30, 28 for *28, 6 for *6, 15 for 15ml.
      6. "manufacturer": Extract manufacturer and country into its own column e.g. "Sanofi aventis - Germany", "AstraZeneca - Sweden", "Merck - Germany", "United - Jordan".
      7. "quantityPacks": Extract main purchased paid box quantity (e.g. 10, 5, 4, 3).
      8. "bonusQuantity": Extract free bonus boxes given (الهدية) e.g. 2 for "10-5free" with 5 quantity, 5 for "10-10free" with 5 quantity, otherwise 0.
      11. "earlyDiscountDays": Extract early payment discount days threshold from notes at bottom of invoice if printed (e.g. 60 if invoice states "خلال شهرين" or 30 if "خلال شهر", otherwise null).
      12. "earlyDiscountPercent": Extract early payment discount percentage from notes at bottom if printed (e.g. 3 if "خصم 3%" or 2 if "خصم 2%", otherwise null).

      Required Output JSON Format:
      {
        "invoiceNumber": "string",
        "supplierName": "string",
        "invoiceDate": "YYYY-MM-DD",
        "totalAmount": number,
        "earlyDiscountDays": number or null,
        "earlyDiscountPercent": number or null,
        "items": [
          {
            "rawName": "string (full raw text line)",
            "tradeName": "string (Clean Commercial Name + Strength e.g. Amaryl 4mg)",
            "strength": "string (e.g. 4mg)",
            "dosageForm": "string (e.g. Tab)",
            "unitsPerPack": number,
            "manufacturer": "string",
            "quantityPacks": number,
            "bonusQuantity": number,
            "purchasePricePack": number,
            "sellingPricePack": number,
            "scientificName": "string",
            "barcode": "string",
            "batchNumber": "string",
            "expiryDate": "YYYY-MM-DD"
          }
        ]
      }

      Important: Return ONLY valid JSON format. Do NOT wrap in markdown or explanations.
    `;

    // Try gemini-2.5-flash, fallback to gemini-1.5-flash
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastError = null;

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

    throw lastError || new Error('All Gemini Vision models failed to process image');
  }
}
