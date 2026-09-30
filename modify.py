import re
with open(r'C:\Users\Dell\Desktop\دوائي\frontend\src\views\ReportsView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('print-section\\"', 'print-section"')
content = content.replace('print-section print-section"', 'print-section"')
content = content.replace('print:hidden\\"', 'print:hidden"')

with open(r'C:\Users\Dell\Desktop\دوائي\frontend\src\views\ReportsView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
