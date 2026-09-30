
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const byBarcode = await prisma.$queryRaw`
    SELECT barcode, COUNT(*) as count, array_agg(id::text) as ids 
    FROM public.medicines 
    WHERE barcode IS NOT NULL AND TRIM(barcode) != '
    GROUP BY barcode 
    HAVING COUNT(*) > 1
  `;
  
  const byName = await prisma.$queryRaw`
    SELECT LOWER(TRIM(trade_name)) as name, COUNT(*) as count, array_agg(id::text) as ids 
    FROM public.medicines 
    GROUP BY LOWER(TRIM(trade_name)) 
    HAVING COUNT(*) > 1
  `;
  
  console.log("Duplicates by Barcode:", byBarcode.length);
  console.dir(byBarcode, { depth: null });
  
  console.log("Duplicates by Name:", byName.length);
  console.dir(byName, { depth: null });
  
  await prisma.$disconnect();
}

check().catch(console.error);

