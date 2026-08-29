import React, { useState } from 'react';
import {
  Barcode,
  Printer,
  X,
  Sparkles,
  CheckCircle2,
  Copy,
} from 'lucide-react';

interface BarcodeGeneratorModalProps {
  item?: any;
  pharmacyName?: string;
  onClose: () => void;
}

export const BarcodeGeneratorModal: React.FC<BarcodeGeneratorModalProps> = ({
  item,
  pharmacyName = 'صيدلية دوائي',
  onClose,
}) => {
  const [barcodeValue, setBarcodeValue] = useState(
    item?.barcode || item?.medicine?.barcode || String(Date.now()).slice(-10),
  );
  const [medicineName, setMedicineName] = useState(item?.tradeName || item?.medicine?.tradeName || 'اسم الدواء');
  const [price, setPrice] = useState<number>(Number(item?.sellingPricePack || item?.defaultSellingPrice || 0));
  const [labelSize, setLabelSize] = useState<'50x30' | '40x25' | '35x20'>('50x30');
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const generateRandomBarcode = () => {
    const randomCode = '628' + Math.floor(100000000 + Math.random() * 900000000);
    setBarcodeValue(randomCode);
  };

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) return;

    let widthMm = 50;
    let heightMm = 30;
    if (labelSize === '40x25') {
      widthMm = 40;
      heightMm = 25;
    } else if (labelSize === '35x20') {
      widthMm = 35;
      heightMm = 20;
    }

    const labelsHtml = Array.from({ length: printCopies })
      .map(
        () => `
        <div class="barcode-sticker">
          <div class="pharmacy-name">${pharmacyName}</div>
          <div class="medicine-name">${medicineName}</div>
          <div class="barcode-lines">
            <!-- Simulated Code128 / EAN lines -->
            <div class="bars"></div>
          </div>
          <div class="barcode-text">${barcodeValue}</div>
          <div class="price-tag">${Number(price).toLocaleString()} د.ع</div>
        </div>
      `,
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>طباعة ملصقات الباركود - ${medicineName}</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #fff;
          }
          .barcode-sticker {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            box-sizing: border-box;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            page-break-after: always;
          }
          .pharmacy-name {
            font-size: 8pt;
            font-weight: bold;
            color: #333;
            max-width: 100%;
            overflow: hidden;
            white-space: nowrap;
          }
          .medicine-name {
            font-size: 9pt;
            font-weight: 900;
            color: #000;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .bars {
            height: 8mm;
            width: 80%;
            background: repeating-linear-gradient(
              to right,
              #000 0px, #000 1.5px,
              #fff 1.5px, #fff 3px,
              #000 3px, #000 5px,
              #fff 5px, #fff 6px,
              #000 6px, #000 7.5px,
              #fff 7.5px, #fff 9px
            );
            margin: 1mm auto;
          }
          .barcode-text {
            font-family: monospace;
            font-size: 8pt;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .price-tag {
            font-size: 10pt;
            font-weight: 900;
            color: #000;
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">توليد وطباعة ملصق الباركود</h3>
              <p className="text-xs text-slate-400">طباعة حرارية لعلب الأدوية والمستلزمات</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Sticker Preview Card */}
        <div className="p-4 bg-slate-100/70 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center space-y-2">
          <div className="text-[10px] font-bold text-slate-400">معاينة شكل الملصق الحراري:</div>
          <div className="w-56 p-3 bg-white border border-slate-400 rounded-xl shadow-md flex flex-col items-center text-center space-y-1 select-none">
            <div className="text-[10px] font-bold text-slate-500 truncate w-full">{pharmacyName}</div>
            <div className="text-xs font-black text-slate-900 truncate w-full">{medicineName}</div>

            {/* Visual Barcode bars */}
            <div className="w-full h-8 bg-repeat-x my-1 flex items-center justify-center">
              <div
                className="h-7 w-40"
                style={{
                  background:
                    'repeating-linear-gradient(to right, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 8px)',
                }}
              ></div>
            </div>

            <div className="text-[11px] font-mono font-bold text-slate-700 tracking-wider">{barcodeValue}</div>
            <div className="text-xs font-black text-emerald-700 font-mono">
              {Number(price).toLocaleString()} د.ع
            </div>
          </div>
        </div>

        {/* Customization Inputs */}
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الدواء المطبوع</label>
              <input
                type="text"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">السعر المطبوع (د.ع)</label>
              <input
                type="number"
                min="0"
                step="250"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 focus:outline-hidden focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">رقم الباركود</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-hidden focus:border-purple-500"
              />
              <button
                type="button"
                onClick={generateRandomBarcode}
                className="px-3 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold whitespace-nowrap cursor-pointer"
                title="توليد باركود عشوائي جديد"
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                توليد
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">مقاس الملصق</label>
              <select
                value={labelSize}
                onChange={(e: any) => setLabelSize(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-purple-500"
              >
                <option value="50x30">50 × 30 مم (قياسي)</option>
                <option value="40x25">40 × 25 مم (وسط)</option>
                <option value="35x20">35 × 20 مم (صغير)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">عدد النسخ</label>
              <input
                type="number"
                min="1"
                max="100"
                value={printCopies}
                onChange={(e) => setPrintCopies(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={handleCopyBarcode}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'تم النسخ' : 'نسخ الرقم'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الملصق ({printCopies})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
