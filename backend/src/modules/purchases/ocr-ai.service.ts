import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ScannedInvoiceItem {
  rawName: string;
  matchedMedicineId: string | null;
  matchedTradeName: string;
  scientificName?: string;
  barcode?: string;
  batchNumber?: string;
  expiryDate: string;
  quantityPacks: number;
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
      const barcode = item.barcode ? String(item.barcode).trim() : undefined;
      const matchResult = await this.matchMedicineInMasterDb(rawName, barcode);

      const purchasePrice = Number(item.purchasePricePack || 0);
      const quantityPacks = Number(item.quantityPacks || 1);
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
        discrepancies.push('⚠️ دواء غير مسجل بالدليل الموحد - يرجى مراجعة الاسم');
      } else if (matchResult.confidence === 'MEDIUM') {
        discrepancies.push(`💡 تم اقتراح المطابقة مع: ${matchResult.tradeName}`);
      }

      if (discrepancies.length > 0) {
        discrepanciesCount += discrepancies.length;
      }

      matchedItems.push({
        rawName,
        matchedMedicineId: matchResult.medicine?.id || null,
        matchedTradeName: matchResult.tradeName || rawName,
        scientificName: matchResult.scientificName || item.scientificName || '',
        barcode: matchResult.barcode || item.barcode || '',
        batchNumber: item.batchNumber ? String(item.batchNumber).trim() : `BN-${Math.floor(1000 + Math.random() * 9000)}`,
        expiryDate,
        quantityPacks,
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
               default_units_per_pack as "unitsPerPack"
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
             default_units_per_pack as "unitsPerPack"
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

    // 3. First Word / Prefix match (e.g. "Panadol" in "Panadol Extra 500mg 24 Tab")
    const words = cleanTerm.split(' ').filter((w) => w.length > 2);
    if (words.length > 0) {
      const prefixMatches: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT id, trade_name as "tradeName", scientific_name as "scientificName", barcode, 
               default_units_per_pack as "unitsPerPack"
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
      You are an expert pharmaceutical accountant and OCR scanner specializing in Iraqi pharmacy supplier invoices (فواتير مذاخر الأدوية).
      Analyze the provided image of a wholesale pharmaceutical invoice and accurately extract the structured items in JSON format.
      
      Required Output JSON Format:
      {
        "invoiceNumber": "string (invoice/bill reference number)",
        "supplierName": "string (name of the drug warehouse / supplier)",
        "invoiceDate": "YYYY-MM-DD",
        "totalAmount": number (total invoice amount in Iraqi Dinars IQD),
        "items": [
          {
            "rawName": "string (Commercial/Trade name with dosage/form e.g. Amoxicillin 500mg Cap)",
            "scientificName": "string or empty",
            "batchNumber": "string (Lot or Batch number printed on the invoice e.g. B12345)",
            "expiryDate": "YYYY-MM-DD",
            "quantityPacks": number (number of boxes/packs purchased),
            "unitsPerPack": number (strips or pieces per box, default 1),
            "purchasePricePack": number (single pack wholesale purchase price in IQD),
            "sellingPricePack": number (suggested retail price if listed, otherwise calculate 20-30% margin),
            "barcode": "string or empty"
          }
        ]
      }
      Important instructions:
      - Clean prices into clean integers in IQD (remove commas, currency symbols).
      - Return ONLY valid JSON format. Do NOT wrap in markdown backticks or explanations.
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
