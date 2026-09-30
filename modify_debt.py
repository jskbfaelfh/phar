import re

with open(r'C:\Users\Dell\Desktop\دوائي\frontend\src\views\SuppliersDebtView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Root div
content = content.replace(
    'return (\n    <div className="flex flex-col gap-5 pb-20">',
    '''return (
    <div className="flex flex-col gap-5 pb-20 suppliers-debt-view">
      <style>{`
        @media print {
          @page { size: auto; margin: 10mm; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .suppliers-debt-view > div:not(.modal-overlay) { display: none !important; }
          .modal-overlay { position: static !important; background: white !important; padding: 0 !important; }
          .modal-content { border: none !important; box-shadow: none !important; max-height: none !important; overflow: visible !important; width: 100% !important; max-width: 100% !important; }
          .modal-close-btn, .print\\\\:hidden, .tabs-header { display: none !important; }
          .print-header { display: block !important; }
          table { width: 100% !important; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #e2e8f0; padding: 8px !important; }
        }
      `}</style>'''
)

# 2. Modal wrappers
content = content.replace(
    '''        {/* Modal 3: Account Statement & Invoices Ledger Modal */}
        {ledgerSupplier && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] 
flex flex-col">'''.replace('\r', ''),
    '''        {/* Modal 3: Account Statement & Invoices Ledger Modal */}
        {ledgerSupplier && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 modal-overlay print:p-0">
            <div className="bg-white rounded-2xl p-5 max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col modal-content">
              {/* Print Header inside Modal */}
              <div className="hidden print:block text-center pb-4 border-b border-slate-300 mb-4 print-header">
                <h1 className="text-2xl font-bold mb-2">صيدلية دوائي</h1>
                <h2 className="text-lg mb-2">كشف حساب مجهز</h2>
                <p className="text-sm text-slate-500">
                  المجهز: {ledgerSupplier.name} | التاريخ: {new Date().toLocaleDateString('ar-IQ')}
                </p>
                {ledgerData && (
                   <p className="text-sm font-bold mt-2">
                     إجمالي الرصيد المتبقي: {Number(ledgerData.summary.totalDebt).toLocaleString()} د.ع
                   </p>
                )}
              </div>'''
)

# Wait, the replacement for modal wrapper might fail because of newlines in my string and the file. Let's use regex instead for robustness.
content = re.sub(
    r'(\{/\* Modal 3: Account Statement & Invoices Ledger Modal \*/\}\s*\{ledgerSupplier && \(\s*<div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">\s*<div className="bg-white rounded-2xl p-5 max-w-3xl w-full shadow-2xl border border-slate-200 max-h-\[90vh\]\s*flex flex-col">)',
    r'''{/* Modal 3: Account Statement & Invoices Ledger Modal */}
        {ledgerSupplier && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 modal-overlay print:p-0">
            <div className="bg-white rounded-2xl p-5 max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col modal-content">
              {/* Print Header inside Modal */}
              <div className="hidden print:block text-center pb-4 border-b border-slate-300 mb-4 print-header">
                <h1 className="text-2xl font-bold mb-2">صيدلية دوائي</h1>
                <h2 className="text-lg mb-2">كشف حساب مجهز</h2>
                <p className="text-sm text-slate-500">
                  المجهز: {ledgerSupplier.name} | التاريخ: {new Date().toLocaleDateString('ar-IQ')}
                </p>
                {ledgerData && (
                   <p className="text-sm font-bold mt-2">
                     إجمالي الرصيد المتبقي: {Number(ledgerData.summary.totalDebt).toLocaleString()} د.ع
                   </p>
                )}
              </div>''',
    content
)

# 3. Add print:hidden to the tabs header
content = content.replace(
    '''{/* Tabs: Invoices vs Payments */}
              <div className="flex border-b border-slate-200 mb-3">''',
    '''{/* Tabs: Invoices vs Payments */}
              <div className="flex border-b border-slate-200 mb-3 tabs-header print:hidden">'''
)

# 4. Add print button & add print:hidden to footer
content = re.sub(
    r'(<div className="pt-4 border-t border-slate-100 flex justify-end">\s*<button\s*onClick=\{\(\) => setLedgerSupplier\(null\)\}\s*className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"\s*>)',
    r'''<div className="pt-4 border-t border-slate-100 flex justify-end gap-2 print:hidden">
                <button
                  onClick={() => {
                    document.title = 'كشف حساب - ' + ledgerSupplier.name + ' - ' + new Date().toLocaleDateString('ar-IQ');
                    window.print();
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  طباعة كشف الحساب
                </button>
                <button
                  onClick={() => setLedgerSupplier(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer modal-close-btn"
                >''',
    content
)

# Also add print:hidden to the header of the modal (close button area)
content = re.sub(
    r'(<div className="flex items-center justify-between pb-3 border-b border-slate-100">)',
    r'\1\n                {/* This header has the modal close button, we hide it in print */}\n                <style>{`@media print { .modal-header { display: none !important; } }`}</style>',
    content
)
content = content.replace(
    '''<div className="flex items-center justify-between pb-3 border-b border-slate-100">''',
    '''<div className="flex items-center justify-between pb-3 border-b border-slate-100 modal-header print:hidden">'''
)


# Make sure Printer icon is imported
if 'Printer' not in content:
    content = content.replace('import {', 'import {\n  Printer,', 1)

with open(r'C:\Users\Dell\Desktop\دوائي\frontend\src\views\SuppliersDebtView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
