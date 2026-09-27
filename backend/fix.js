
const fs = require("fs");
const path = require("path");
const filePath = "C:/Users/Dell/Desktop/دوائي/frontend/src/views/BulkStockEntryView.tsx";
let content = fs.readFileSync(filePath, "utf-8");

const regex = /const parseSmartLine = \(line: string, lineIndex: number, currentYear: number\): TableRowItem \| null => \{[\s\S]*?isNewMedicine: true,\n    \};\n  \};/;

const newParser = `const parseSmartLine = (line: string, lineIndex: number, currentYear: number): TableRowItem | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const normalizedLine = trimmed.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    let sep = "\\t";
    if (normalizedLine.includes("\\t")) sep = "\\t";
    else if (normalizedLine.includes(";") && !normalizedLine.includes(",")) sep = ";";
    else if (normalizedLine.includes(",")) sep = ",";

    let cells = normalizedLine.split(sep).map((c) => c.trim().replace(/^[\u0022\u0027]|[\u0022\u0027]$/g, "").trim());
    if (cells.length < 2) {
      if (normalizedLine.split(/\\s{2,}/).length >= 2) {
        cells = normalizedLine.split(/\\s{2,}/).map((c) => c.trim());
      } else {
        return null;
      }
    }

    const joined = cells.join(" ");
    if (/(الباركود|المادة|اسم المادة|السعر|الرصيد|الكمية|الاكسباير|المبيع|تاريخ|Barcode|Trade Name|Price|Qty|EXP)/i.test(joined)) {
      return null;
    }

    let tradeName = "";
    let nameIdx = -1;
    let maxLetters = 0;
    for (let i = 0; i < cells.length; i++) {
      const letters = cells[i].replace(/[^a-zA-Z\u0600-\u06FF]/g, "");
      if (letters.length > maxLetters && !/^(د\\.ع|IQD|USD|\\$|pack|box|كرتونة|قطعة)$/i.test(cells[i].trim())) {
        maxLetters = letters.length;
        tradeName = cells[i].trim();
        nameIdx = i;
      }
    }

    if (!tradeName) {
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].length > 0 && isNaN(Number(cells[i].replace(/[\\s-]/g, "")))) {
          tradeName = cells[i].trim();
          nameIdx = i;
          break;
        }
      }
    }

    let barcode = "";
    let barcodeIdx = -1;
    for (let i = 0; i < nameIdx; i++) {
      const raw = cells[i].replace(/[\\s-]/g, "");
      if (/^\\d+$/.test(raw)) {
        if (i === 0 && parseInt(raw, 10) === lineIndex + 1) continue;
        barcode = raw;
        barcodeIdx = i;
        break;
      }
    }
    if (!barcode) {
      for (let i = 0; i < cells.length; i++) {
        if (i === nameIdx) continue;
        const raw = cells[i].replace(/[\\s-]/g, "");
        if (/^\\d{7,16}$/.test(raw)) {
          barcode = raw;
          barcodeIdx = i;
          break;
        }
      }
    }

    let discount = 0;
    let discountIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      if (i === barcodeIdx || i === nameIdx) continue;
      if (cells[i].includes("%")) {
        const d = parseFloat(cells[i].replace(/[^\\d.]/g, ""));
        if (!isNaN(d)) {
          discount = d;
          discountIdx = i;
          break;
        }
      }
    }

    let expiryMonth = 12;
    let expiryYear = currentYear + 2;
    let expiryIdx = -1;
    let expiryIdx2 = -1;
    let hasExplicitExpiry = false;

    for (let i = 0; i < cells.length; i++) {
      if (i === barcodeIdx || i === discountIdx || i === nameIdx) continue;
      const cellText = cells[i].trim();
      const matchA = cellText.match(/^0?([1-9]|1[0-2])\\s*[\\/\\-\\\\\\.]\\s*(20\\d{2}|\\d{2})$/);
      if (matchA) {
        const m = parseInt(matchA[1], 10);
        let y = parseInt(matchA[2], 10);
        if (y < 100) y = 2000 + y;
        if (y >= 2024 && y <= 2045) {
          expiryMonth = m;
          expiryYear = y;
          expiryIdx = i;
          hasExplicitExpiry = true;
          break;
        }
      }
      const matchB = cellText.match(/^(20\\d{2})\\s*[\\/\\-\\\\\\.]\\s*0?([1-9]|1[0-2])$/);
      if (matchB) {
        const y = parseInt(matchB[1], 10);
        const m = parseInt(matchB[2], 10);
        if (y >= 2024 && y <= 2045) {
          expiryYear = y;
          expiryMonth = m;
          expiryIdx = i;
          hasExplicitExpiry = true;
          break;
        }
      }
    }
    if (!hasExplicitExpiry) {
      for (let i = 0; i < cells.length - 1; i++) {
        if (i === barcodeIdx || i === discountIdx || i === nameIdx) continue;
        const c1 = parseInt(cells[i].replace(/[^\\d]/g, ""), 10);
        const c2 = parseInt(cells[i + 1].replace(/[^\\d]/g, ""), 10);
        if (c1 >= 1 && c1 <= 12) {
          let y = c2;
          if (y < 100 && y >= 24 && y <= 45) y = 2000 + y;
          if (y >= 2024 && y <= 2045) {
            expiryMonth = c1;
            expiryYear = y;
            expiryIdx = i;
            expiryIdx2 = i + 1;
            hasExplicitExpiry = true;
            break;
          }
        }
      }
    }

    const numericCells = [];
    for (let i = 0; i < cells.length; i++) {
      if (i === barcodeIdx || i === discountIdx || i === nameIdx || i === expiryIdx || i === expiryIdx2) continue;
      const cleaned = cells[i].replace(/[^\\d.]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n > 0) {
        numericCells.push({ idx: i, val: n });
      }
    }

    const filteredNumerics = numericCells.filter((c) => !(c.idx === 0 && c.val === lineIndex + 1));
    const priceCells = filteredNumerics.filter((c) => c.val >= 250);
    const smallCandidates = filteredNumerics.filter((c) => c.val < 250);

    let purchasePrice = 0;
    let explicitSellingPrice = 0;
    let qty = 1;
    let unitsPerPk = 1;

    if (priceCells.length >= 2) {
      purchasePrice = priceCells[0].val;
      for (let k = 1; k < priceCells.length; k++) {
        if (priceCells[k].val > purchasePrice) {
          explicitSellingPrice = priceCells[k].val;
          break;
        }
      }
    } else if (priceCells.length === 1) {
      purchasePrice = priceCells[0].val;
    } else if (filteredNumerics.length > 0) {
      purchasePrice = filteredNumerics[filteredNumerics.length - 1].val;
    }

    if (smallCandidates.length >= 2) {
      qty = Math.max(1, Math.round(smallCandidates[0].val));
      unitsPerPk = Math.max(1, Math.round(smallCandidates[1].val));
    } else if (smallCandidates.length === 1) {
      qty = Math.max(1, Math.round(smallCandidates[0].val));
    }

    if (!tradeName && !barcode) return null;

    const sellingPrice = explicitSellingPrice > 0 
      ? (explicitSellingPrice) 
      : (purchasePrice > 0 ? (Math.round(purchasePrice * 1.2)) : 0);

    return {
      tempId: ` + "`" + `import-\${Date.now()}-\${lineIndex}-\${Math.random().toString(36).substring(2, 6)}` + "`" + `,
      tradeName: tradeName || "صنف بدون اسم",
      scientificName: "",
      barcode: barcode || undefined,
      unitsPerPack: unitsPerPk,
      quantityPacks: qty,
      bonusPacks: 0,
      amortizeBonus: true,
      discountPercent: discount,
      purchasePricePack: purchasePrice,
      sellingPricePack: sellingPrice,
      sellingPriceUnit: sellingPrice,
      officialPricePack: sellingPrice,
      officialPriceUnit: sellingPrice,
      expiryMonth,
      expiryYear,
      hasMissingExpiry: !hasExplicitExpiry,
      isNewMedicine: true,
    };
  };`;

content = content.replace(regex, newParser);
fs.writeFileSync(filePath, content, "utf-8");
console.log("Update Complete");

