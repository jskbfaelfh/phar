
const fs = require("fs");
const content = fs.readFileSync("C:/Users/Dell/Desktop/دوائي/backend/src/modules/purchases/purchases.service.ts", "utf8");
const start = content.indexOf("// 5. Calculate financials");
const end = content.indexOf("// 8. Update purchases and purchase_invoices header");
const section = content.substring(start, end);

const lines = section.split("\n");
lines.forEach((line, i) => {
    if (line.includes("remainingAmount =") || line.includes("totalAmount =") || line.includes("dto.items.length =")) {
        console.log(`Line ${i}: ${line.trim()}`);
    }
});

