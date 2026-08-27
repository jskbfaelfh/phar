import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('Using DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded successfully' : 'Not loaded');
  console.log('Seeding initial medicines into Master DB...');

  const sampleMedicines = [
    {
      tradeName: 'Panadol Extra',
      scientificName: 'Paracetamol 500mg + Caffeine 65mg',
      dosageForm: 'أقراص / حبوب',
      strength: '500mg/65mg',
      manufacturer: 'GSK',
      barcode: '5054563039835',
      defaultUnitsPerPack: 2,
    },
    {
      tradeName: 'Amoxil 500mg',
      scientificName: 'Amoxicillin',
      dosageForm: 'كبسول',
      strength: '500mg',
      manufacturer: 'GSK / SDI',
      barcode: '6281002938121',
      defaultUnitsPerPack: 2,
    },
    {
      tradeName: 'Augmentin 1g',
      scientificName: 'Amoxicillin + Clavulanic Acid',
      dosageForm: 'أقراص',
      strength: '1g (875/125mg)',
      manufacturer: 'GSK',
      barcode: '5000158068994',
      defaultUnitsPerPack: 2,
    },
    {
      tradeName: 'Profen 400mg',
      scientificName: 'Ibuprofen',
      dosageForm: 'حبوب',
      strength: '400mg',
      manufacturer: 'Julphar / SDI',
      barcode: '6291007010452',
      defaultUnitsPerPack: 3,
    },
    {
      tradeName: 'Cataflam 50mg',
      scientificName: 'Diclofenac Potassium',
      dosageForm: 'حبوب ملبسة',
      strength: '50mg',
      manufacturer: 'Novartis',
      barcode: '7680538910023',
      defaultUnitsPerPack: 2,
    },
    {
      tradeName: 'Flagyl 500mg',
      scientificName: 'Metronidazole',
      dosageForm: 'حبوب',
      strength: '500mg',
      manufacturer: 'Sanofi',
      barcode: '3582910034812',
      defaultUnitsPerPack: 2,
    },
    {
      tradeName: 'Nexium 40mg',
      scientificName: 'Esomeprazole',
      dosageForm: 'أقراص مقاومة للمعدة',
      strength: '40mg',
      manufacturer: 'AstraZeneca',
      barcode: '7323190014022',
      defaultUnitsPerPack: 2,
    },
    {
      tradeName: 'Concor 5mg',
      scientificName: 'Bisoprolol Fumarate',
      dosageForm: 'حبوب',
      strength: '5mg',
      manufacturer: 'Merck',
      barcode: '4022536109923',
      defaultUnitsPerPack: 3,
    },
    {
      tradeName: 'Lipitor 20mg',
      scientificName: 'Atorvastatin Calcium',
      dosageForm: 'أقراص',
      strength: '20mg',
      manufacturer: 'Pfizer',
      barcode: '5415062301928',
      defaultUnitsPerPack: 3,
    },
    {
      tradeName: 'Ventolin Inhaler',
      scientificName: 'Salbutamol',
      dosageForm: 'بخاخ استنشاق',
      strength: '100mcg',
      manufacturer: 'GSK',
      barcode: '5000158019484',
      defaultUnitsPerPack: 1,
    },
  ];

  for (const med of sampleMedicines) {
    const existing = await prisma.medicine.findFirst({
      where: { tradeName: med.tradeName },
    });
    if (!existing) {
      await prisma.medicine.create({ data: med });
    }
  }

  console.log(`Successfully seeded ${sampleMedicines.length} medicines!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
