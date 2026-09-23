import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PackagePlus,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Save,
  Building2,
  CreditCard,
  Banknote,
  Clock,
  Tag,
  BadgePercent,
  Camera,
  FileSpreadsheet,
  X,
  Upload,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Gift,
  Percent,
  MapPin,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { roundTo250, calculateStripPrice } from '../utils/currency';
import { SmartExpiryInput } from '../components/SmartExpiryInput';
import { PriceChangesReviewModal, type ChangedPriceItem } from '../components/PriceChangesReviewModal';
import { CameraBarcodeScannerModal } from '../components/CameraBarcodeScannerModal';

interface TableRowItem {
  tempId: string;
  medicineId?: string;
  customName?: string;
  isNewMedicine?: boolean;
  tradeName: string;
  scientificName: string;
  dosageForm?: string;
  strength?: string;
  manufacturer?: string;
  barcode?: string;
  unitsPerPack: number;
  quantityPacks: number;
  bonusPacks: number;
  amortizeBonus?: boolean;
  bonusBatchNumber?: string;
  bonusExpiryMonth?: number;
  bonusExpiryYear?: number;
  showBonusConfig?: boolean;
  discountPercent: number;
  purchasePricePack: number;
  lastPurchasePricePack?: number;
  sellingPricePack: number;
  sellingPriceUnit: number;
  officialPricePack?: number;
  officialPriceUnit?: number;
  expiryMonth: number;
  expiryYear: number;
  batchNumber?: string;
  shelfLocation?: string;
  hasPreviousBatch?: boolean;
  showExtraFields?: boolean;
  hasMissingExpiry?: boolean;
}

export const BulkStockEntryView: React.FC = () => {
  // Suppliers state
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');

  // Payment / Debt status
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UNPAID' | 'PARTIAL'>('PAID');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Direct Overall Invoice Discount
  const [directDiscountType, setDirectDiscountType] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');
  const [directDiscountValue, setDirectDiscountValue] = useState<number>(0);

  // Price changes review modal state
  const [showPriceChangesModal, setShowPriceChangesModal] = useState(false);
  const [changedItemsForReview, setChangedItemsForReview] = useState<ChangedPriceItem[]>([]);

  // Search & Table
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [items, setItems] = useState<TableRowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Excel/CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // New Medicine Modal State
  const [showNewMedModal, setShowNewMedModal] = useState(false);
  const [showNewMedExtras, setShowNewMedExtras] = useState(false);
  const [newMedForm, setNewMedForm] = useState({
    tradeName: '',
    scientificName: '',
    customName: '',
    dosageForm: 'أقراص / حبوب',
    strength: '',
    manufacturer: '',
    barcode: '',
    unitsPerPack: 2,
    quantityPacks: 10,
    bonusPacks: 0,
    amortizeBonus: true,
    discountPercent: 0,
    purchasePricePack: 0,
    sellingPricePack: 0,
    expiryMonth: 12,
    expiryYear: new Date().getFullYear() + 2,
    shelfLocation: '',
  });

  // Fetch saved suppliers list
  const fetchSuppliers = async () => {
    try {
      const data = await apiRequest<any[]>('/inventory/suppliers');
      setSuppliers(data || []);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // ─── Smart Content-Based Excel / CSV Parser ────────────────────────────────
  const parseSmartLine = (line: string, lineIndex: number, currentYear: number): TableRowItem | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Convert Arabic/Eastern digits (٠-٩) to Standard digits (0-9)
    const normalizedLine = trimmed.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

    // Detect separator: Tab, Semicolon, Comma, or multi-space
    let sep = '\t';
    if (normalizedLine.includes('\t')) sep = '\t';
    else if (normalizedLine.includes(';') && !normalizedLine.includes(',')) sep = ';';
    else if (normalizedLine.includes(',')) sep = ',';

    let cells = normalizedLine.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, '').trim());
    if (cells.length < 2) {
      if (normalizedLine.split(/\s{2,}/).length >= 2) {
        cells = normalizedLine.split(/\s{2,}/).map((c) => c.trim());
      } else {
        return null;
      }
    }

    // Check if this row is a header row (e.g. contains words like 'باركود', 'المادة', 'السعر')
    const joined = cells.join(' ');
    if (/(الباركود|المادة|اسم المادة|السعر|العدد|الكمية|المجموع|الخصم|تاريخ|Barcode|Trade Name|Price|Qty|EXP)/i.test(joined)) {
      return null;
    }

    // 1. Identify Barcode: Pure digits of 7 to 16 digits length
    let barcode = '';
    let barcodeIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      const raw = cells[i].replace(/[\s-]/g, '');
      if (/^\d{7,16}$/.test(raw)) {
        barcode = raw;
        barcodeIdx = i;
        break;
      }
    }

    // 2. Identify Discount %: cell containing '%'
    let discount = 0;
    let discountIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      if (i === barcodeIdx) continue;
      if (cells[i].includes('%')) {
        const d = parseFloat(cells[i].replace(/[^\d.]/g, ''));
        if (!isNaN(d)) {
          discount = d;
          discountIdx = i;
          break;
        }
      }
    }

    // 3. Strict Expiry Date Extraction (MM/YY, MM/YYYY, MM\YY, MM\YYYY, MM-YY, YYYY-MM, etc.)
    let expiryMonth = 12;
    let expiryYear = currentYear + 2;
    let expiryIdx = -1;
    let expiryIdx2 = -1;
    let hasExplicitExpiry = false;

    for (let i = 0; i < cells.length; i++) {
      if (i === barcodeIdx || i === discountIdx) continue;
      const cellText = cells[i].trim();

      // Format A: MM/YY, MM/YYYY, MM\YY, MM\YYYY, MM-YY, MM.YY, etc. (e.g., 7\27, 07/27, 07/2027, 12\40, 4\31)
      const matchA = cellText.match(/^0?([1-9]|1[0-2])\s*[\/\-\\.]\s*(20\d{2}|\d{2})$/);
      if (matchA) {
        const m = parseInt(matchA[1], 10);
        let y = parseInt(matchA[2], 10);
        if (y < 100) y = 2000 + y; // e.g. 27 -> 2027, 31 -> 2031, 40 -> 2040
        if (y >= 2024 && y <= 2045) {
          expiryMonth = m;
          expiryYear = y;
          expiryIdx = i;
          hasExplicitExpiry = true;
          break;
        }
      }

      // Format B: YYYY/MM, YYYY-MM, YYYY\MM (e.g. 2027/07, 2027-07)
      const matchB = cellText.match(/^(20\d{2})\s*[\/\-\\.]\s*0?([1-9]|1[0-2])$/);
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

    // Fallback: Two adjacent numeric cells where cell 1 is 1-12 and cell 2 is 2024-2045 or 24-45
    if (!hasExplicitExpiry) {
      for (let i = 0; i < cells.length - 1; i++) {
        if (i === barcodeIdx || i === discountIdx) continue;
        const c1 = parseInt(cells[i].replace(/[^\d]/g, ''), 10);
        const c2 = parseInt(cells[i + 1].replace(/[^\d]/g, ''), 10);
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

    // 4. Identify Medicine Name: Cell with the most Arabic/English letters
    let tradeName = '';
    let nameIdx = -1;
    let maxLetters = 0;
    for (let i = 0; i < cells.length; i++) {
      if (i === barcodeIdx || i === discountIdx || i === expiryIdx || i === expiryIdx2) continue;
      const letters = cells[i].replace(/[^a-zA-Z\u0600-\u06FF]/g, '');
      if (letters.length > maxLetters && !/^(د\.ع|IQD|USD|\$|pack|box|علبة|قطعة)$/i.test(cells[i].trim())) {
        maxLetters = letters.length;
        tradeName = cells[i].trim();
        nameIdx = i;
      }
    }

    // Fallback for name if no letters
    if (!tradeName) {
      for (let i = 0; i < cells.length; i++) {
        if (i !== barcodeIdx && i !== discountIdx && i !== expiryIdx && i !== expiryIdx2 && cells[i].length > 0) {
          tradeName = cells[i].trim();
          nameIdx = i;
          break;
        }
      }
    }

    // 5. Collect remaining numeric cells (for qty, price, total)
    const numericCells: { idx: number; val: number }[] = [];
    for (let i = 0; i < cells.length; i++) {
      if (i === barcodeIdx || i === discountIdx || i === nameIdx || i === expiryIdx || i === expiryIdx2) continue;
      const cleaned = cells[i].replace(/[^\d.]/g, '');
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n > 0) {
        numericCells.push({ idx: i, val: n });
      }
    }

    // Exclude row index numbers matching 1, 2, 3... at position 0
    const filteredNumerics = numericCells.filter((c) => !(c.idx === 0 && c.val === lineIndex + 1));

    // In Iraq, wholesale unit prices are >= 250 IQD
    const priceCells = filteredNumerics.filter((c) => c.val >= 250);
    const smallCandidates = filteredNumerics.filter((c) => c.val < 250);

    let purchasePrice = 0;
    let explicitSellingPrice = 0;
    let qty = 1;

    if (priceCells.length >= 2) {
      // First price cell is purchase price
      purchasePrice = priceCells[0].val;

      // Check if there is an explicit selling price column (a distinct price > purchasePrice)
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

    // Check quantity from small candidates (< 250)
    if (smallCandidates.length > 0) {
      qty = Math.max(1, Math.round(smallCandidates[0].val));
    }

    if (!tradeName && !barcode) return null;

    // Selling price: Use explicit selling price if imported from Excel, otherwise default to +20% markup
    const sellingPrice = explicitSellingPrice > 0 
      ? roundTo250(explicitSellingPrice) 
      : (purchasePrice > 0 ? roundTo250(Math.round(purchasePrice * 1.2)) : 0);

    return {
      tempId: `import-${Date.now()}-${lineIndex}-${Math.random().toString(36).substring(2, 6)}`,
      tradeName: tradeName || 'صنف بدون اسم',
      scientificName: '',
      barcode: barcode || undefined,
      unitsPerPack: 1,
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
  };

  const previewRows = useMemo(() => {
    if (!importText.trim()) return [];
    const lines = importText.trim().split('\n').filter((l) => l.trim());
    const currentYear = new Date().getFullYear();
    const rows: TableRowItem[] = [];
    for (let i = 0; i < lines.length; i++) {
      const item = parseSmartLine(lines[i], i, currentYear);
      if (item) rows.push(item);
    }
    return rows;
  }, [importText]);

  const parseAndImportExcel = () => {
    setImportError('');
    if (previewRows.length === 0) {
      setImportError('تعذّر التعرف على أي أصناف صالحة. تأكد من نسخ صفوف الفاتورة.');
      return;
    }

    setItems((prev) => [...previewRows, ...prev]);
    setShowImportModal(false);
    setImportText('');
    setMessage({
      type: 'success',
      text: `✅ تم استيراد ${previewRows.length} صنف بنجاح! تم كشف الأسماء والباركودات والأسعار والكميات تلقائياً وبدقة.`,
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };
  // ─────────────────────────────────────────────────────────────────────────



  // Search medicines from catalog
  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    if (navigator.onLine) {
      try {
        const data = await apiRequest<any[]>(`/medicines/search?q=${encodeURIComponent(term)}`);
        setSearchResults(data || []);
        return;
      } catch (err) {
        console.warn('Online catalog search failed, falling back to local database:', err);
      }
    }

    // Offline search fallback
    try {
      const { searchLocalMasterMedicines } = await import('../utils/localDatabase');
      const localResults = await searchLocalMasterMedicines(term);
      setSearchResults(localResults || []);
    } catch (e) {
      console.error('Offline master medicines search error:', e);
    }
  };

  // Add selected medicine to grid with auto-prefill from last pharmacy batch
  const addMedicineToGrid = async (med: any) => {
    const currentYear = new Date().getFullYear();
    const tempId = Math.random().toString();

    // 1. Fetch previous batch history for this medicine in this pharmacy
    let history: any = null;
    try {
      const lookupKey = med.id || med.barcode;
      history = await apiRequest<any>(`/inventory/medicine-last-history/${encodeURIComponent(lookupKey)}`);
    } catch (e) {
      console.warn('Could not fetch medicine last history:', e);
    }

    const defaultUnits = Number(
      history?.unitsPerPack || med.defaultUnitsPerPack || med.unitsPerPack || 1,
    );
    const purchasePricePack = Number(
      history?.purchasePricePack || med.defaultPurchasePrice || 0,
    );
    const sellingPricePack = Number(history?.sellingPricePack || 0);
    let sellingPriceUnit = Number(history?.sellingPriceUnit || 0);
    if (sellingPriceUnit === 0 && sellingPricePack > 0 && defaultUnits > 0) {
      sellingPriceUnit = calculateStripPrice(sellingPricePack, defaultUnits);
    }

    const bonusPacks = Number(history?.bonusPacks || 0);
    const shelfLocation = history?.shelfLocation || '';
    const expiryMonth = Number(history?.expiryMonth || 12);
    const expiryYear = Number(history?.expiryYear || currentYear + 2);
    const hasPreviousBatch = !!history?.hasPreviousBatch;
    const lastPurchasePrice = Number(history?.lastPurchasePricePack || history?.purchasePricePack || med.defaultPurchasePrice || 0);

    const newRow: TableRowItem = {
      tempId,
      medicineId: med.id,
      customName:
        history?.tradeName && history.tradeName !== med.tradeName ? history.tradeName : '',
      tradeName: med.tradeName,
      scientificName: med.scientificName || '',
      dosageForm: med.dosageForm,
      strength: med.strength,
      barcode: med.barcode,
      unitsPerPack: defaultUnits,
      quantityPacks: 10,
      bonusPacks,
      amortizeBonus: true,
      showBonusConfig: false,
      discountPercent: 0,
      purchasePricePack,
      lastPurchasePricePack: lastPurchasePrice,
      sellingPricePack,
      sellingPriceUnit,
      officialPricePack: Number(history?.officialPricePack || sellingPricePack),
      officialPriceUnit: Number(history?.officialPriceUnit || sellingPriceUnit),
      expiryMonth,
      expiryYear,
      batchNumber: '',
      shelfLocation,
      hasPreviousBatch,
    };

    setItems((prev) => [newRow, ...prev]);
    setSearchTerm('');
    setSearchResults([]);

    // Auto-focus on the first field (Quantity) of the newly added row
    setTimeout(() => {
      const firstInput = document.getElementById(`input-qty-0`);
      if (firstInput) {
        firstInput.focus();
        (firstInput as HTMLInputElement).select?.();
      }
    }, 50);
  };

  // Update specific field in row
  const updateRowField = (tempId: string, field: keyof TableRowItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.tempId !== tempId) return item;

        const updated = { ...item, [field]: value };

        // Auto-calculate unit price when pack price or unitsPerPack changes
        if (field === 'sellingPricePack' || field === 'unitsPerPack') {
          const packPrice = field === 'sellingPricePack' ? Number(value) : Number(item.sellingPricePack);
          const units = field === 'unitsPerPack' ? Number(value) : Number(item.unitsPerPack);
          if (units > 0 && packPrice > 0) {
            updated.sellingPriceUnit = calculateStripPrice(packPrice, units);
          }
        }

        // Auto-calculate official unit price when official pack price changes
        if (field === 'officialPricePack' || field === 'unitsPerPack') {
          const offPack = field === 'officialPricePack' ? Number(value) : Number(item.officialPricePack ?? item.sellingPricePack);
          const units = field === 'unitsPerPack' ? Number(value) : Number(item.unitsPerPack);
          if (units > 0 && offPack > 0) {
            updated.officialPriceUnit = calculateStripPrice(offPack, units);
          }
        }

        return updated;
      }),
    );
  };

  const removeRow = (tempId: string) => {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  // Toggle amortization across all items with bonus
  const setAllBonusAmortized = (amortized: boolean) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        amortizeBonus: amortized,
      })),
    );
  };

  // Fast Enter Key navigation helper
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, nextFieldId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldId) {
        const nextElem = document.getElementById(nextFieldId);
        if (nextElem) {
          nextElem.focus();
        }
      }
    }
  };

  // Calculations
  const grossTotal = items.reduce((sum, i) => sum + Number(i.purchasePricePack || 0) * Number(i.quantityPacks || 0), 0);
  const itemsDiscountTotal = items.reduce(
    (sum, i) =>
      sum +
      Number(i.purchasePricePack || 0) * Number(i.quantityPacks || 0) * (Number(i.discountPercent || 0) / 100),
    0,
  );
  const subtotalAfterItemsDiscount = Math.max(0, grossTotal - itemsDiscountTotal);

  const directDiscountAmount = directDiscountType === 'PERCENT'
    ? roundTo250(Math.round(subtotalAfterItemsDiscount * (Math.min(100, Math.max(0, directDiscountValue)) / 100)))
    : roundTo250(Math.min(subtotalAfterItemsDiscount, Math.max(0, directDiscountValue)));

  const totalDiscount = itemsDiscountTotal + directDiscountAmount;
  const totalBonusValue = items.reduce(
    (sum, i) => sum + Number(i.bonusPacks || 0) * Number(i.purchasePricePack || 0),
    0,
  );
  const netInvoiceTotal = roundTo250(Math.max(0, subtotalAfterItemsDiscount - directDiscountAmount));

  // Update paid amount automatically when payment status or total changes
  useEffect(() => {
    if (paymentStatus === 'PAID') {
      setPaidAmount(netInvoiceTotal);
    } else if (paymentStatus === 'UNPAID') {
      setPaidAmount(0);
    }
  }, [paymentStatus, netInvoiceTotal]);

  const remainingDebt = Math.max(0, netInvoiceTotal - paidAmount);

  // Submit new brand-new medicine from footer modal into table
  const handleAddNewMedicineToBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const newRow: TableRowItem = {
      tempId: Math.random().toString(),
      isNewMedicine: true,
      customName: newMedForm.customName || undefined,
      tradeName: newMedForm.tradeName,
      scientificName: newMedForm.scientificName,
      dosageForm: newMedForm.dosageForm || undefined,
      strength: newMedForm.strength || undefined,
      manufacturer: newMedForm.manufacturer || undefined,
      barcode: newMedForm.barcode || undefined,
      unitsPerPack: Number(newMedForm.unitsPerPack || 1),
      quantityPacks: Number(newMedForm.quantityPacks || 1),
      bonusPacks: Number(newMedForm.bonusPacks || 0),
      amortizeBonus: newMedForm.amortizeBonus !== false,
      showBonusConfig: false,
      discountPercent: Number(newMedForm.discountPercent || 0),
      purchasePricePack: Number(newMedForm.purchasePricePack || 0),
      sellingPricePack: Number(newMedForm.sellingPricePack || 0),
      sellingPriceUnit: calculateStripPrice(
        Number(newMedForm.sellingPricePack || 0),
        Number(newMedForm.unitsPerPack || 1),
      ),
      expiryMonth: Number(newMedForm.expiryMonth),
      expiryYear: Number(newMedForm.expiryYear),
      shelfLocation: newMedForm.shelfLocation || '',
    };

    setItems((prev) => [newRow, ...prev]);
    setShowNewMedModal(false);
    setNewMedForm({
      tradeName: '',
      scientificName: '',
      customName: '',
      dosageForm: 'أقراص / حبوب',
      strength: '',
      manufacturer: '',
      barcode: '',
      unitsPerPack: 2,
      quantityPacks: 10,
      bonusPacks: 0,
      amortizeBonus: true,
      discountPercent: 0,
      purchasePricePack: 0,
      sellingPricePack: 0,
      expiryMonth: 12,
      expiryYear: new Date().getFullYear() + 2,
      shelfLocation: '',
    });
  };

  // Save the entire batch to DB
  const handleSaveBulkBatch = async (forceConfirm = false) => {
    if (items.length === 0) {
      alert('يرجى إضافة مادة واحدة على الأقل في الوجبة');
      return;
    }

    if (!forceConfirm) {
      const changed = items
        .filter(
          (i) =>
            i.lastPurchasePricePack !== undefined &&
            i.lastPurchasePricePack > 0 &&
            i.purchasePricePack > 0 &&
            i.purchasePricePack !== i.lastPurchasePricePack,
        )
        .map((i) => ({
          id: i.tempId,
          tradeName: i.customName || i.tradeName,
          lastPurchasePrice: i.lastPurchasePricePack!,
          newPurchasePrice: i.purchasePricePack,
          unitsPerPack: i.unitsPerPack,
        }));

      if (changed.length > 0) {
        setChangedItemsForReview(changed);
        setShowPriceChangesModal(true);
        return;
      }
    }

    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        supplierId: selectedSupplierId || undefined,
        supplierName: supplierName || undefined,
        supplierPhone: supplierPhone || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        paymentStatus,
        paidAmount: Number(paidAmount),
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        directDiscountAmount: directDiscountAmount > 0 ? directDiscountAmount : undefined,
        directDiscountType,
        directDiscountPercent: directDiscountType === 'PERCENT' && directDiscountValue > 0 ? directDiscountValue : undefined,
        items: items.map((i) => ({
          medicineId: i.medicineId,
          customName: i.customName || undefined,
          barcode: i.barcode?.trim() || undefined,
          newMedicineData: i.isNewMedicine
            ? {
                tradeName: i.tradeName,
                scientificName: i.scientificName?.trim() || undefined,
                dosageForm: i.dosageForm,
                strength: i.strength,
                manufacturer: i.manufacturer,
                barcode: i.barcode,
                defaultUnitsPerPack: i.unitsPerPack,
              }
            : undefined,
          unitsPerPack: Number(i.unitsPerPack),
          quantityPacks: Number(i.quantityPacks),
          bonusPacks: Number(i.bonusPacks || 0),
          amortizeBonus: i.amortizeBonus !== false,
          bonusBatchNumber: i.bonusBatchNumber?.trim() || undefined,
          bonusExpiryMonth: i.bonusExpiryMonth ? Number(i.bonusExpiryMonth) : undefined,
          bonusExpiryYear: i.bonusExpiryYear ? Number(i.bonusExpiryYear) : undefined,
          discountPercent: Math.min(100, Math.max(0, Number(i.discountPercent || 0))),
          purchasePricePack: Number(i.purchasePricePack),
          sellingPricePack: Number(i.sellingPricePack),
          sellingPriceUnit: Number(i.sellingPriceUnit),
          officialPricePack: Number(i.officialPricePack !== undefined ? i.officialPricePack : i.sellingPricePack),
          officialPriceUnit: Number(i.officialPriceUnit !== undefined ? i.officialPriceUnit : i.sellingPriceUnit),
          expiryMonth: Number(i.expiryMonth),
          expiryYear: Number(i.expiryYear),
          batchNumber: i.batchNumber || undefined,
          shelfLocation: i.shelfLocation || undefined,
        })),
      };

      if (navigator.onLine) {
        try {
          const result = await apiRequest<any>('/inventory/bulk-entry', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          setMessage({ type: 'success', text: result.message });
          setItems([]);
          setSupplierName('');
          setSupplierPhone('');
          setSelectedSupplierId('');
          setSupplierInvoiceNumber('');
          setPaymentStatus('PAID');
          setPaidAmount(0);
          setDueDate('');
          setNotes('');
          setDirectDiscountValue(0);
          fetchSuppliers();
          return;
        } catch (err: any) {
          if (err?.status && err.status >= 400 && err.status < 500) {
            setMessage({ type: 'error', text: err.message || 'فشل حفظ الوجبة' });
            setLoading(false);
            return;
          }
        }
      }

      // Offline Bulk Entry Fallback Queue
      const { queueOutboxOperation } = await import('../utils/outboxQueue');
      await queueOutboxOperation('PURCHASE', '/inventory/bulk-entry', payload);

      setMessage({
        type: 'success',
        text: 'تم حفظ وتثبيت الوجبة محلياً بالمخزن! وسيتم مزامنتها تلقائياً فور توفر الإنترنت 📡',
      });
      setItems([]);
      setSupplierName('');
      setSupplierPhone('');
      setSelectedSupplierId('');
      setSupplierInvoiceNumber('');
      setPaymentStatus('PAID');
      setPaidAmount(0);
      setDueDate('');
      setNotes('');
      setDirectDiscountValue(0);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل حفظ الوجبة محلياً' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-16">
      {/* 1. Header & Live Financial Breakdown Widget */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <PackagePlus className="w-6 h-6 text-indigo-600" />
              إدخال وجبة
            </h1>
          </div>

          {/* Live Financial Totals Badge */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-right">
              <span className="text-[11px] font-bold text-slate-500 block">الإجمالي</span>
              <span className="text-sm font-black text-slate-800">{grossTotal.toLocaleString()} د.ع</span>
            </div>

            {totalDiscount > 0 && (
              <div className="bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 text-right">
                <span className="text-[11px] font-bold text-rose-700 block">
                  الخصم {directDiscountAmount > 0 ? `(مباشر: ${directDiscountAmount.toLocaleString()})` : ''}
                </span>
                <span className="text-sm font-black text-rose-800">-{totalDiscount.toLocaleString()} د.ع</span>
              </div>
            )}

            {totalBonusValue > 0 && (
              <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-right">
                <span className="text-[11px] font-bold text-amber-800 block">البونص</span>
                <span className="text-sm font-black text-amber-900">+{totalBonusValue.toLocaleString()} د.ع</span>
              </div>
            )}

            <div className="bg-indigo-600 px-3.5 py-1.5 rounded-xl text-right text-white shadow-xs">
              <span className="text-[11px] font-bold text-indigo-100 block">الصافي</span>
              <span className="text-base font-black">{netInvoiceTotal.toLocaleString()} د.ع</span>
            </div>

            <button
              onClick={() => handleSaveBulkBatch(false)}
              disabled={items.length === 0 || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? 'جاري الحفظ...' : `حفظ الوجبة (${items.length})`}
            </button>
          </div>
        </div>

        {/* 2. Supplier & Payment Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Supplier Selector / Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              المذخر
            </label>
            <div className="flex gap-1.5">
              {suppliers.length > 0 ? (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    const sId = e.target.value;
                    setSelectedSupplierId(sId);
                    const found = suppliers.find((s) => s.id === sId);
                    if (found) {
                      setSupplierName(found.name);
                      setSupplierPhone(found.phone || '');
                    } else {
                      setSupplierName('');
                    }
                  }}
                  className="w-1/2 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                >
                  <option value="">-- اختر مذخر --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.totalRemainingDebt > 0 ? `(دين: ${Number(s.totalRemainingDebt).toLocaleString()} د.ع)` : ''}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                type="text"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setSelectedSupplierId('');
                }}
                placeholder="اسم المذخر..."
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Supplier Invoice Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رقم الفاتورة</label>
            <input
              type="text"
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              placeholder="مثال: INV-98231"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
            />
          </div>

          {/* Direct Overall Invoice Discount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <BadgePercent className="w-3.5 h-3.5 text-rose-600" />
                خصم مباشر للفاتورة
              </label>
              <div className="inline-flex rounded-lg bg-slate-200 p-0.5 text-[10px] font-black">
                <button
                  type="button"
                  onClick={() => setDirectDiscountType('AMOUNT')}
                  className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                    directDiscountType === 'AMOUNT' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  د.ع
                </button>
                <button
                  type="button"
                  onClick={() => setDirectDiscountType('PERCENT')}
                  className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                    directDiscountType === 'PERCENT' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step={directDiscountType === 'AMOUNT' ? '250' : '1'}
                value={directDiscountValue || ''}
                onChange={(e) => setDirectDiscountValue(Math.max(0, Number(e.target.value)))}
                placeholder={directDiscountType === 'AMOUNT' ? 'مبلغ الخصم د.ع...' : 'نسبة الخصم %...'}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-rose-700 font-mono placeholder:text-slate-400 focus:bg-white focus:border-rose-500 focus:outline-hidden"
              />
              {directDiscountType === 'PERCENT' && directDiscountValue > 0 && (
                <span className="absolute left-2 top-1.5 text-[10px] font-mono font-bold text-rose-600">
                  = {directDiscountAmount.toLocaleString()} د.ع
                </span>
              )}
            </div>
          </div>

          {/* Payment Status (Cash / Credit / Partial) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              حالة السداد
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setPaymentStatus('PAID')}
                className={`py-1.5 text-[11px] font-bold rounded-md transition-all ${
                  paymentStatus === 'PAID'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                نقداً
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus('UNPAID')}
                className={`py-1.5 text-[11px] font-bold rounded-md transition-all ${
                  paymentStatus === 'UNPAID'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                آجل
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus('PARTIAL')}
                className={`py-1.5 text-[11px] font-bold rounded-md transition-all ${
                  paymentStatus === 'PARTIAL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                جزئي
              </button>
            </div>
          </div>

          {/* Paid amount & Due Date if Credit/Partial */}
          <div>
            {paymentStatus === 'PARTIAL' ? (
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">المدفوع نقداً</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="250"
                    max={netInvoiceTotal}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-black text-amber-950"
                  />
                  <div className="text-[10px] text-slate-500 whitespace-nowrap self-center font-bold">
                    المتبقي: {remainingDebt.toLocaleString()} د.ع
                  </div>
                </div>
              </div>
            ) : paymentStatus === 'UNPAID' ? (
              <div>
                <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  تاريخ الاستحقاق
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-rose-50 border border-rose-300 rounded-lg text-xs font-bold text-rose-900"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  حالة الدفع
                </label>
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  مسدد بالكامل ({netInvoiceTotal.toLocaleString()} د.ع)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          {message.text}
        </div>
      )}

      {/* 3. Fast Barcode & Search Input */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchResults.length > 0) {
                    await addMedicineToGrid(searchResults[0]);
                  } else if (searchTerm.trim().length > 0) {
                    try {
                      const directMatches = await apiRequest<any[]>(
                        `/medicines/search?q=${encodeURIComponent(searchTerm.trim())}`,
                      );
                      if (directMatches && directMatches.length > 0) {
                        await addMedicineToGrid(directMatches[0]);
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }
                }
              }}
              placeholder="امسح الباركود أو اكتب اسم الدواء ثم اضغط Enter..."
              className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            {/* Camera Barcode Scanner */}
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="مسح الباركود بكاميرا الجهاز (Webcam Scanner)"
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>كاميرا 📷</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewMedForm((prev) => ({
                ...prev,
                tradeName: searchTerm,
                barcode: /^\d+$/.test(searchTerm) ? searchTerm : '',
              }));
              setShowNewMedModal(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="تسجيل دواء جديد غير موجود في الدليل الموحد"
          >
            <Plus className="w-4 h-4" />
            <span>➕ تسجيل دواء جديد</span>
          </button>
        </div>

        {/* Live Search Autocomplete Dropdown */}
        {searchTerm.trim().length > 0 && (
          <div className="absolute left-4 right-4 top-14 bg-white rounded-xl shadow-xl border border-slate-200 max-h-64 overflow-y-auto z-20 divide-y divide-slate-100">
            {searchResults.length > 0 ? (
              searchResults.map((med) => (
                <div
                  key={med.id}
                  onClick={() => addMedicineToGrid(med)}
                  className="p-3 hover:bg-indigo-50/70 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{med.tradeName}</div>
                    <div className="text-xs text-slate-500">
                      {med.scientificName} • ({med.defaultUnitsPerPack || 1} أشرطة) • {med.dosageForm || ''}
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                    إدراج
                  </button>
                </div>
              ))
            ) : (
              <div className="p-4 text-center space-y-2.5">
                <div className="text-xs font-bold text-slate-600">
                  لم يتم العثور على <span className="text-indigo-600 font-black">"{searchTerm}"</span> في الدليل الموحد
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewMedForm((prev) => ({
                      ...prev,
                      tradeName: searchTerm,
                      barcode: /^\d+$/.test(searchTerm) ? searchTerm : '',
                    }));
                    setShowNewMedModal(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>دواء جديد +</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Main Interactive Grid Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              أدوية الوجبة ({items.length})
            </h2>

            {/* Excel Import Button */}
            <button
              type="button"
              onClick={() => { setShowImportModal(true); setImportError(''); setImportText(''); }}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="استيراد أصناف من ملف Excel أو CSV أو نسخ-لصق"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              استيراد Excel
            </button>

            {items.some((i) => Number(i.bonusPacks || 0) > 0) && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                <span className="text-amber-900">تطبيق البونص:</span>
                <button
                  type="button"
                  onClick={() => setAllBonusAmortized(true)}
                  className="px-2 py-0.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] cursor-pointer shadow-2xs font-black transition-colors"
                  title="تذويب البونص على سعر الشراء لكل أدوية الفاتورة"
                >
                  💧 تذويب الكل
                </button>
                <button
                  type="button"
                  onClick={() => setAllBonusAmortized(false)}
                  className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-md text-[10px] cursor-pointer shadow-2xs font-black transition-colors"
                  title="فصل البونص كوجبات مجانية منفصلة (كلفة 0) لكل أدوية الفاتورة"
                >
                  🎁 وجبات منفصلة للكل
                </button>
              </div>
            )}
          </div>
          <span className="text-xs text-slate-400 font-bold">
            (Enter للتنقل)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-10 text-center">#</th>
                <th className="p-2.5 min-w-[180px]">الدواء</th>
                <th className="p-2.5 min-w-[130px]">الباركود</th>
                <th className="p-2.5 w-20 text-center">الكمية</th>
                <th className="p-2.5 w-20 text-center">الشريط/علبة</th>
                <th className="p-2.5 w-28">شراء الباكيت</th>
                <th className="p-2.5 w-28 bg-amber-50/70 text-amber-900 border-b border-amber-200">
                  <span className="flex items-center justify-center gap-1 font-black">
                    🏛️ الرسمي
                  </span>
                </th>
                <th className="p-2.5 w-28 font-black text-emerald-900 bg-emerald-50/70">بيع الفعلي (علبة)</th>
                <th className="p-2.5 w-28 font-black text-blue-900 bg-blue-50/70">بيع الفعلي (شريط)</th>
                <th className="p-2.5 w-32">الصلاحية</th>
                <th className="p-2.5 w-24">الوجبة</th>
                <th className="p-2.5 w-24 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-slate-400 font-bold">
                    <PackagePlus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    لا توجد أدوية بعد.
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => {
                  const qtyPacks = Number(row.quantityPacks || 0);
                  const bonusPacks = Number(row.bonusPacks || 0);
                  const totalPacks = qtyPacks + bonusPacks;
                  const discount = Number(row.discountPercent || 0);
                  const listPrice = Number(row.purchasePricePack || 0);

                  const grossLine = qtyPacks * listPrice;
                  const netLine = grossLine * (1 - discount / 100);
                  const isAmortized = row.amortizeBonus !== false;
                  const effectiveCostPerPack = isAmortized
                    ? (totalPacks > 0 ? Math.round(netLine / totalPacks) : listPrice)
                    : (qtyPacks > 0 ? Math.round(netLine / qtyPacks) : listPrice);

                  return (
                    <React.Fragment key={row.tempId}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>

                        {/* 1. Medicine Info & Custom Name Input + Badges for Extra Fields */}
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900 text-xs">{row.tradeName}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[190px]">{row.scientificName}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {row.hasPreviousBatch && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                مسترد من الوجبة السابقة
                              </span>
                            )}
                            {row.isNewMedicine && (
                              <span className="inline-block px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-bold">
                                دواء جديد كلياً
                              </span>
                            )}
                            {bonusPacks > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black">
                                <Gift className="w-2.5 h-2.5 text-amber-600" />
                                +{bonusPacks} بونص {isAmortized ? '(مذوب)' : '(منفصل)'}
                              </span>
                            )}
                            {discount > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-rose-100 text-rose-900 border border-rose-300 rounded text-[9px] font-black">
                                <Percent className="w-2.5 h-2.5 text-rose-600" />
                                {discount}% خصم
                              </span>
                            )}
                            {row.shelfLocation && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-300 rounded text-[9px] font-bold">
                                <MapPin className="w-2.5 h-2.5 text-slate-500" />
                                رف: {row.shelfLocation}
                              </span>
                            )}
                          </div>
                          <div className="mt-1">
                            <input
                              type="text"
                              value={row.customName || ''}
                              onChange={(e) => updateRowField(row.tempId, 'customName', e.target.value)}
                              placeholder="اسم دارج..."
                              className="w-full px-2 py-1 bg-amber-50/50 border border-amber-200 rounded-md text-[10px] text-amber-950 font-bold placeholder:text-amber-600/60"
                            />
                          </div>
                        </td>

                        {/* 2. Barcode Input */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.barcode || ''}
                            onChange={(e) => updateRowField(row.tempId, 'barcode', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, `input-qty-${idx}`)}
                            placeholder="امسح أو اكتب..."
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-md font-mono text-xs text-slate-800 focus:bg-white focus:border-indigo-500"
                          />
                        </td>

                        {/* 3. Quantity Packs */}
                        <td className="p-2">
                          <input
                            id={`input-qty-${idx}`}
                            type="number"
                            min="1"
                            value={row.quantityPacks}
                            onChange={(e) => updateRowField(row.tempId, 'quantityPacks', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, `input-units-${idx}`)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md font-black text-slate-900 text-center"
                          />
                        </td>

                        {/* 4. Units Per Pack */}
                        <td className="p-2">
                          <input
                            id={`input-units-${idx}`}
                            type="number"
                            min="1"
                            value={row.unitsPerPack}
                            onChange={(e) => updateRowField(row.tempId, 'unitsPerPack', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, `input-price-${idx}`)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-center text-slate-700 font-bold"
                          />
                        </td>

                        {/* 5. List Purchase Price */}
                        <td className="p-2">
                          <input
                            id={`input-price-${idx}`}
                            type="number"
                            min="0"
                            step="1"
                            value={row.purchasePricePack}
                            onChange={(e) => updateRowField(row.tempId, 'purchasePricePack', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, `input-official-pack-${idx}`)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-900 text-left"
                          />
                          {row.lastPurchasePricePack !== undefined &&
                            row.lastPurchasePricePack > 0 &&
                            row.purchasePricePack > 0 &&
                            row.purchasePricePack !== row.lastPurchasePricePack && (
                              <div
                                className={`text-[10px] mt-1 font-bold leading-tight ${
                                  row.purchasePricePack > row.lastPurchasePricePack
                                    ? 'text-rose-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {row.purchasePricePack > row.lastPurchasePricePack
                                  ? `🔺 ارتفع (${row.lastPurchasePricePack.toLocaleString()} د.ع)`
                                  : `🔻 انخفض (${row.lastPurchasePricePack.toLocaleString()} د.ع)`}
                              </div>
                            )}
                        </td>

                        {/* 6. Official Price Pack (🏛️ الرسمي) */}
                        <td className="p-2 bg-amber-50/30">
                          <input
                            id={`input-official-pack-${idx}`}
                            type="number"
                            min="0"
                            step="1"
                            value={row.officialPricePack ?? row.sellingPricePack}
                            onChange={(e) => updateRowField(row.tempId, 'officialPricePack', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, `input-selling-pack-${idx}`)}
                            className="w-full px-2 py-1.5 bg-amber-50 border border-amber-300 text-amber-950 rounded-md font-bold text-left"
                            placeholder="الرسمي"
                          />
                        </td>

                        {/* 7. Selling Price Pack (بيع الفعلي علبة) */}
                        <td className="p-2">
                          <input
                            id={`input-selling-pack-${idx}`}
                            type="number"
                            min="0"
                            step="1"
                            value={row.sellingPricePack}
                            onChange={(e) => updateRowField(row.tempId, 'sellingPricePack', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, `input-selling-unit-${idx}`)}
                            className="w-full px-2 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-md font-black text-left"
                          />
                        </td>

                        {/* 8. Selling Price Unit (بيع الفعلي شريط) */}
                        <td className="p-2">
                          <input
                            id={`input-selling-unit-${idx}`}
                            type="number"
                            min="0"
                            step="1"
                            value={row.sellingPriceUnit}
                            onChange={(e) => updateRowField(row.tempId, 'sellingPriceUnit', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, `input-exp-month-${idx}`)}
                            className="w-full px-2 py-1.5 bg-blue-50 border border-blue-300 text-blue-950 rounded-md font-black text-left"
                          />
                        </td>

                        {/* 9. Expiry Date (الصلاحية) */}
                        <td className="p-2">
                          <SmartExpiryInput
                            month={row.expiryMonth}
                            year={row.expiryYear}
                            monthId={`input-exp-month-${idx}`}
                            yearId={`input-exp-year-${idx}`}
                            onChange={(m, y) => {
                              updateRowField(row.tempId, 'expiryMonth', m);
                              updateRowField(row.tempId, 'expiryYear', y);
                            }}
                            onNext={() => {
                              const batchInput = document.getElementById(`input-batch-${idx}`);
                              if (batchInput) {
                                batchInput.focus();
                                (batchInput as HTMLInputElement).select?.();
                              }
                            }}
                          />
                        </td>

                        {/* 10. Batch Number (الوجبة) */}
                        <td className="p-2">
                          <input
                            id={`input-batch-${idx}`}
                            type="text"
                            value={row.batchNumber || ''}
                            onChange={(e) => updateRowField(row.tempId, 'batchNumber', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                searchInputRef.current?.focus();
                                searchInputRef.current?.select();
                              }
                            }}
                            placeholder="اختياري"
                            className="w-full px-1.5 py-1.5 bg-white border border-slate-300 rounded-md text-center text-xs font-mono"
                          />
                        </td>

                        {/* 11. Actions: زر "المزيد" + زر الحذف */}
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateRowField(row.tempId, 'showExtraFields', !row.showExtraFields)}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-0.5 shadow-2xs ${
                                row.showExtraFields || bonusPacks > 0 || discount > 0 || row.shelfLocation
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                              title="إظهار / إخفاء (البونص، الخصم، الرف)"
                            >
                              {row.showExtraFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              <span>المزيد</span>
                              {(bonusPacks > 0 || discount > 0 || row.shelfLocation) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block mr-0.5" />
                              )}
                            </button>
                            <button
                              onClick={() => removeRow(row.tempId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="حذف من الفاتورة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable "المزيد" Sub-Panel: Bonus, Discount %, Shelf Location */}
                      {row.showExtraFields && (
                        <tr className="bg-indigo-50/30 border-b border-indigo-100">
                          <td colSpan={12} className="p-3 bg-gradient-to-r from-slate-50 via-indigo-50/25 to-slate-50">
                            <div className="flex flex-wrap items-start gap-4 p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 w-full pb-1.5 border-b border-slate-100">
                                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                                <span>خيارات إضافية: {row.tradeName}</span>
                              </div>

                              {/* 1. Bonus Pack */}
                              <div className="flex-1 min-w-[210px] bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                                <label className="block text-[11px] font-bold text-amber-900 mb-1 flex items-center gap-1">
                                  <Gift className="w-3.5 h-3.5 text-amber-600" />
                                  البونص المجاني (علب):
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    id={`input-bonus-${idx}`}
                                    type="number"
                                    min="0"
                                    value={row.bonusPacks}
                                    onChange={(e) => updateRowField(row.tempId, 'bonusPacks', Number(e.target.value))}
                                    className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-md font-black text-amber-900 text-center text-xs"
                                    placeholder="0"
                                  />
                                  {bonusPacks > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => updateRowField(row.tempId, 'amortizeBonus', !isAmortized)}
                                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer shadow-2xs ${
                                        isAmortized
                                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {isAmortized ? '💧 تذويب السعر' : '🎁 وجبة منفصلة'}
                                    </button>
                                  )}
                                </div>
                                {!isAmortized && bonusPacks > 0 && (
                                  <div className="mt-2 pt-2 border-t border-amber-200 space-y-1 text-right">
                                    <div>
                                      <label className="text-slate-600 block text-[9px]">رقم تشغيلة البونص:</label>
                                      <input
                                        type="text"
                                        value={row.bonusBatchNumber ?? (row.batchNumber ? `${row.batchNumber}-BONUS` : '')}
                                        onChange={(e) => updateRowField(row.tempId, 'bonusBatchNumber', e.target.value)}
                                        className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono"
                                        placeholder="اختياري"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-slate-600 block text-[9px]">صلاحية البونص:</label>
                                      <SmartExpiryInput
                                        month={row.bonusExpiryMonth || row.expiryMonth}
                                        year={row.bonusExpiryYear || row.expiryYear}
                                        onChange={(m, y) => {
                                          updateRowField(row.tempId, 'bonusExpiryMonth', m);
                                          updateRowField(row.tempId, 'bonusExpiryYear', y);
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 2. Discount % */}
                              <div className="flex-1 min-w-[210px] bg-rose-50/50 p-2.5 rounded-lg border border-rose-200">
                                <label className="block text-[11px] font-bold text-rose-900 mb-1 flex items-center gap-1">
                                  <Percent className="w-3.5 h-3.5 text-rose-600" />
                                  نسبة الخصم (%):
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    id={`input-discount-${idx}`}
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={row.discountPercent}
                                    onChange={(e) => updateRowField(row.tempId, 'discountPercent', Number(e.target.value))}
                                    className="w-20 px-2 py-1 bg-white border border-rose-300 rounded-md font-black text-rose-900 text-center text-xs"
                                    placeholder="0%"
                                  />
                                  <div className="text-[11px] text-slate-700 font-bold">
                                    صافي الكلفة: <span className="text-indigo-900 font-black">{effectiveCostPerPack.toLocaleString()} د.ع</span>
                                  </div>
                                </div>
                              </div>

                              {/* 3. Shelf Location */}
                              <div className="flex-1 min-w-[180px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                  موقع الرف (Shelf):
                                </label>
                                <input
                                  id={`input-shelf-${idx}`}
                                  type="text"
                                  value={row.shelfLocation || ''}
                                  onChange={(e) => updateRowField(row.tempId, 'shelfLocation', e.target.value)}
                                  placeholder="مثال: A-01"
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-bold font-mono text-slate-900 focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Footer Adder for Brand-New Medicines */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setShowNewMedModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            + إضافة دواء جديد
          </button>

          <div className="text-xs font-bold text-slate-600">
            العدد: <span className="text-slate-900 font-black text-sm">{items.length}</span>
          </div>
        </div>
      </div>

      {/* Modal for Brand-New Medicine */}
      {showNewMedModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              إضافة دواء جديد
            </h3>

            <form onSubmit={handleAddNewMedicineToBatch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم التجاري *</label>
                  <input
                    type="text"
                    required
                    value={newMedForm.tradeName}
                    onChange={(e) => setNewMedForm({ ...newMedForm, tradeName: e.target.value })}
                    placeholder="مثال: Catafast"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم العلمي *</label>
                  <input
                    type="text"
                    required
                    value={newMedForm.scientificName}
                    onChange={(e) => setNewMedForm({ ...newMedForm, scientificName: e.target.value })}
                    placeholder="مثال: Diclofenac"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Custom Name */}
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  الاسم الدارج (اختياري)
                </label>
                <input
                  type="text"
                  value={newMedForm.customName}
                  onChange={(e) => setNewMedForm({ ...newMedForm, customName: e.target.value })}
                  placeholder="مثال: كاتفست أصفر"
                  className="w-full px-3 py-2 border border-amber-300 bg-amber-50/50 rounded-lg text-sm font-bold text-amber-950"
                />
              </div>

              {/* Barcode Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>الباركود (اختياري)</span>
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 cursor-pointer"
                  >
                    <Camera className="w-3 h-3 text-indigo-600" />
                    <span>مسح بالكاميرا 📷</span>
                  </button>
                </label>
                <input
                  type="text"
                  value={newMedForm.barcode}
                  onChange={(e) => setNewMedForm({ ...newMedForm, barcode: e.target.value })}
                  placeholder="امسح الباركود أو اكتبه..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الشكل</label>
                  <input
                    type="text"
                    value={newMedForm.dosageForm}
                    onChange={(e) => setNewMedForm({ ...newMedForm, dosageForm: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التركيز</label>
                  <input
                    type="text"
                    value={newMedForm.strength}
                    onChange={(e) => setNewMedForm({ ...newMedForm, strength: e.target.value })}
                    placeholder="50mg"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">أشرطة/علبة</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newMedForm.unitsPerPack}
                    onChange={(e) => setNewMedForm({ ...newMedForm, unitsPerPack: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كمية العلب *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newMedForm.quantityPacks}
                    onChange={(e) => setNewMedForm({ ...newMedForm, quantityPacks: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر الشراء (د.ع)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={newMedForm.purchasePricePack}
                    onChange={(e) => setNewMedForm({ ...newMedForm, purchasePricePack: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع (د.ع) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={newMedForm.sellingPricePack}
                    onChange={(e) => setNewMedForm({ ...newMedForm, sellingPricePack: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-950 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شهر / سنة الصلاحية (1-12 و 20XX)
                </label>
                <SmartExpiryInput
                  month={newMedForm.expiryMonth}
                  year={newMedForm.expiryYear}
                  onChange={(m, y) =>
                    setNewMedForm((prev) => ({ ...prev, expiryMonth: m, expiryYear: y }))
                  }
                />
              </div>

              {/* Toggle Button for Extra Fields (المزيد: البونص، الخصم، الرف) */}
              <button
                type="button"
                onClick={() => setShowNewMedExtras(!showNewMedExtras)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                  showNewMedExtras || newMedForm.bonusPacks > 0 || newMedForm.discountPercent > 0 || newMedForm.shelfLocation
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>المزيد (البونص، الخصم، الرف)</span>
                  {(newMedForm.bonusPacks > 0 || newMedForm.discountPercent > 0 || newMedForm.shelfLocation) && (
                    <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded text-[10px] font-bold">مُحدد</span>
                  )}
                </span>
                {showNewMedExtras ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>

              {/* Collapsed Section for Extra Fields */}
              {showNewMedExtras && (
                <div className="p-3 bg-slate-50 rounded-xl border border-indigo-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-amber-600" />
                        بونص مجاني (علب):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newMedForm.bonusPacks}
                        onChange={(e) => setNewMedForm({ ...newMedForm, bonusPacks: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-amber-300 bg-amber-50 text-amber-950 rounded-lg text-sm font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-rose-900 mb-1 flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-rose-600" />
                        نسبة الخصم (%):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newMedForm.discountPercent}
                        onChange={(e) => setNewMedForm({ ...newMedForm, discountPercent: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-rose-300 bg-rose-50 text-rose-950 rounded-lg text-sm font-bold"
                        placeholder="0%"
                      />
                    </div>
                  </div>

                  {Number(newMedForm.bonusPacks || 0) > 0 && (
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-900">طريقة احتساب البونص:</span>
                      <button
                        type="button"
                        onClick={() => setNewMedForm({ ...newMedForm, amortizeBonus: !newMedForm.amortizeBonus })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          newMedForm.amortizeBonus
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        }`}
                      >
                        {newMedForm.amortizeBonus ? '💧 تذويب السعر' : '🎁 وجبة منفصلة'}
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      موقع الرف (Shelf Location):
                    </label>
                    <input
                      type="text"
                      value={newMedForm.shelfLocation}
                      onChange={(e) =>
                        setNewMedForm((prev) => ({ ...prev, shelfLocation: e.target.value }))
                      }
                      placeholder="مثال: A-01"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold font-mono text-slate-900 bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  إدراج الدواء في الفاتورة
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewMedModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Alert for Purchase Price Changes before Confirmation */}
      <PriceChangesReviewModal
        isOpen={showPriceChangesModal}
        items={changedItemsForReview}
        onConfirm={() => {
          setShowPriceChangesModal(false);
          handleSaveBulkBatch(true);
        }}
        onCancel={() => setShowPriceChangesModal(false)}
        isSubmitting={loading}
      />

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={(scannedBarcode) => {
          if (showNewMedModal) {
            setNewMedForm((prev) => ({ ...prev, barcode: scannedBarcode }));
          } else {
            handleSearch(scannedBarcode);
          }
        }}
        title="مسح باركود الدواء لكشوفات الشحنة بكاميرا الجهاز"
      />

      {/* ─── Excel / CSV Import Modal ─────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-slate-900 text-base">استيراد أصناف من Excel / CSV</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 leading-relaxed">
                <div className="font-bold text-sm mb-1.5">📋 طريقة الاستخدام:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>افتح الفاتورة في <strong>Excel</strong> أو <strong>Google Sheets</strong></li>
                  <li>حدد جميع الصفوف والأعمدة → <strong>Ctrl+C</strong></li>
                  <li>الصق في المربع أدناه → <strong>Ctrl+V</strong></li>
                  <li>أو ارفع ملف <strong>.csv</strong> مباشرة</li>
                </ol>
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <span className="font-bold">الأعمدة المدعومة تلقائياً وذكياً:</span> الباركود | اسم المادة | الكمية | سعر الشراء | الخصم% | <strong>الاكسباير (مثل: 07/27 أو 07/2027)</strong>
                </div>
              </div>

              {/* File Upload */}
              <div className="flex items-center gap-3">
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  رفع ملف CSV
                </button>
                <span className="text-xs text-slate-400">أو الصق البيانات مباشرة أدناه</span>
              </div>

              {/* Paste Area */}
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`الصق هنا بيانات الفاتورة من Excel (Ctrl+V)...\n\nمثال:\n1\t8809517414315\tMedicube ZERO PORE PAD MILD 155g\t1\t19000\t0\t7/27\n2\t8809640737190\tANUA Azelaic Acid Serum\t1\t20000\t0\t4/31`}
                rows={10}
                dir="ltr"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white resize-y"
              />

              {/* Live Preview Table */}
              {previewRows.length > 0 && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>معاينة التعرف الذكي (تم التعرف على {previewRows.length} صنف):</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                      معاينة أول {Math.min(6, previewRows.length)} أصناف
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-white">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-emerald-100/60 text-emerald-950 font-bold border-b border-emerald-200">
                        <tr>
                          <th className="p-1.5 text-center">#</th>
                          <th className="p-1.5">اسم الدواء</th>
                          <th className="p-1.5">الباركود</th>
                          <th className="p-1.5 text-center">الكمية</th>
                          <th className="p-1.5 text-left">شراء الباكيت</th>
                          <th className="p-1.5 text-left">بيع مقترح</th>
                          <th className="p-1.5 text-center">الخصم</th>
                          <th className="p-1.5 text-center">الاكسباير</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                        {previewRows.slice(0, 6).map((row, pIdx) => (
                          <tr key={pIdx} className="hover:bg-slate-50">
                            <td className="p-1.5 text-center text-slate-400 font-mono">{pIdx + 1}</td>
                            <td className="p-1.5 font-bold text-slate-900 max-w-[180px] truncate">{row.tradeName}</td>
                            <td className="p-1.5 font-mono text-indigo-700">{row.barcode || '-'}</td>
                            <td className="p-1.5 text-center font-black text-slate-900">{row.quantityPacks}</td>
                            <td className="p-1.5 text-left font-mono font-black text-slate-900">{row.purchasePricePack.toLocaleString()} د.ع</td>
                            <td className="p-1.5 text-left font-mono font-black text-emerald-700">{row.sellingPricePack.toLocaleString()} د.ع</td>
                            <td className="p-1.5 text-center font-mono text-rose-600">{row.discountPercent > 0 ? `${row.discountPercent}%` : '0%'}</td>
                            <td className="p-1.5 text-center font-mono font-bold">
                              {row.hasMissingExpiry ? (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded border border-amber-300 inline-block">⚠️ يجب تحديده</span>
                              ) : (
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">{String(row.expiryMonth).padStart(2, '0')}/{row.expiryYear}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  {importError}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800">
                ⚠️ <strong>تنبيه:</strong> سعر البيع مقترح تلقائياً بـ <strong>+20% من سعر الشراء</strong>. يمكنك تعديل أي سعر أو تاريخ في الجدول بعد الاستيراد.
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={parseAndImportExcel}
                disabled={previewRows.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold cursor-pointer inline-flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                استيراد ({previewRows.length} صنف)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────────────── */}
    </div>
  );
};
