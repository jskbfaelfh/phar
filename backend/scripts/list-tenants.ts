import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      schemaName: true,
      governorate: true,
      district: true,
      phone: true,
      licenseKey: true,
      subscriptionStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('COUNT:', tenants.length);
  console.log(JSON.stringify(tenants, null, 2));
}

main().finally(() => prisma.$disconnect());
