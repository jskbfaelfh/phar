
const fs = require("fs");

function addTimeouts(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, "utf-8");

    // We want to find: const transactionResult = await this.prisma.$transaction(
    // Then find the matching closing parenthesis for it.
    let index = 0;
    while (true) {
        index = content.indexOf("const transactionResult = await this.prisma.$transaction(", index);
        if (index === -1) break;
        
        let startParen = content.indexOf("(", index);
        let openParens = 1;
        let curr = startParen + 1;
        
        while (curr < content.length && openParens > 0) {
            if (content[curr] === "(") openParens++;
            if (content[curr] === ")") openParens--;
            curr++;
        }
        
        if (openParens === 0) {
            let endParen = curr - 1;
            // Check if we already added it
            let beforeEnd = content.substring(endParen - 20, endParen);
            if (!beforeEnd.includes("timeout:")) {
                content = content.substring(0, endParen) + ", { maxWait: 20000, timeout: 60000 }" + content.substring(endParen);
            }
        }
        index = curr;
    }

    fs.writeFileSync(filePath, content, "utf-8");
}

addTimeouts("C:/Users/Dell/Desktop/دوائي/backend/src/modules/inventory/inventory.service.ts");
addTimeouts("C:/Users/Dell/Desktop/دوائي/backend/src/modules/purchases/purchases.service.ts");
addTimeouts("C:/Users/Dell/Desktop/دوائي/backend/src/modules/sales/sales.service.ts");

