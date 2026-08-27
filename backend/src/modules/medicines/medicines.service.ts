import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateMedicineDto, QueryMedicineDto } from './dto/create-medicine.dto';

@Injectable()
export class MedicinesService {
  private readonly logger = new Logger(MedicinesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search medicines in Global Catalog by tradeName, scientificName, or barcode
   */
  async search(query: QueryMedicineDto) {
    const { q, barcode, limit = 30 } = query;
    const where: any = {};

    if (barcode) {
      where.barcode = barcode;
    } else if (q && q.trim().length > 0) {
      const searchTerm = q.trim();
      where.OR = [
        { tradeName: { contains: searchTerm, mode: 'insensitive' } },
        { scientificName: { contains: searchTerm, mode: 'insensitive' } },
        { barcode: { contains: searchTerm, mode: 'insensitive' } },
        { manufacturer: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.medicine.findMany({
      where,
      take: Math.min(limit, 100),
      orderBy: { tradeName: 'asc' },
    });
  }

  /**
   * Get single medicine details
   */
  async findById(id: string) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id },
    });
    if (!medicine) {
      throw new NotFoundException('الدواء غير موجود في الدليل الموحد');
    }
    return medicine;
  }

  /**
   * Add a new medicine to the Global Catalog
   */
  async create(dto: CreateMedicineDto) {
    // If barcode exists, check for duplicate
    if (dto.barcode) {
      const existing = await this.prisma.medicine.findFirst({
        where: { barcode: dto.barcode },
      });
      if (existing) {
        throw new ConflictException(`يوجد دواء مسجل مسبقاً بنفس الباركود: ${existing.tradeName}`);
      }
    }

    const medicine = await this.prisma.medicine.create({
      data: {
        tradeName: dto.tradeName,
        scientificName: dto.scientificName,
        dosageForm: dto.dosageForm,
        strength: dto.strength,
        manufacturer: dto.manufacturer,
        barcode: dto.barcode,
        defaultUnitsPerPack: dto.defaultUnitsPerPack || 1,
        isVerified: dto.isVerified !== undefined ? dto.isVerified : true,
      },
    });

    return medicine;
  }

  /**
   * Seed common essential medicines used in Iraqi pharmacies for instant testing
   */
  async seedInitialMedicines() {
    const count = await this.prisma.medicine.count();
    if (count > 0) {
      return { message: 'قاعدة بيانات الأدوية تحتوي على بيانات مسبقاً', count };
    }

    const sampleMedicines = [
      {
        tradeName: 'Panadol Extra',
        scientificName: 'Paracetamol 500mg + Caffeine 65mg',
        dosageForm: 'أقراص / حبوب',
        strength: '500mg/65mg',
        manufacturer: 'GSK',
        barcode: '5054563039835',
        defaultUnitsPerPack: 2, // 2 أشرطة بالعلبة (24 قرص)
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
        defaultUnitsPerPack: 2, // 14 قرص (شريطان)
      },
      {
        tradeName: 'Profen 400mg',
        scientificName: 'Ibuprofen',
        dosageForm: 'حبوب',
        strength: '400mg',
        manufacturer: 'Julphar / SDI',
        barcode: '6291007010452',
        defaultUnitsPerPack: 3, // 3 أشرطة
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
        defaultUnitsPerPack: 2, // 28 قرص (شريطان)
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
        strength: '100mcg (200 doses)',
        manufacturer: 'GSK',
        barcode: '5000158019484',
        defaultUnitsPerPack: 1, // بخاخ واحد
      },
    ];

    await this.prisma.medicine.createMany({
      data: sampleMedicines,
    });

    this.logger.log(`Seeded ${sampleMedicines.length} initial medicines into Master DB.`);
    return { message: 'تم إدخال قائمة الأدوية الأولية بنجاح', count: sampleMedicines.length };
  }
}
