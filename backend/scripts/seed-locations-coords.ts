import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const IRAQ_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // كربلاء
  'كربلاء': { lat: 32.6160, lng: 44.0249 },
  'كربلاء المقدسة': { lat: 32.6160, lng: 44.0249 },
  'عون': { lat: 32.6500, lng: 44.0500 },
  'الحسين': { lat: 32.6100, lng: 44.0200 },
  'سيف سعد': { lat: 32.5950, lng: 44.0150 },
  'البلدية': { lat: 32.6180, lng: 44.0300 },
  'حي الحسين': { lat: 32.6100, lng: 44.0200 },

  // النجف
  'النجف': { lat: 32.0000, lng: 44.3333 },
  'النجف الأشرف': { lat: 32.0000, lng: 44.3333 },
  'الكوفة': { lat: 32.0300, lng: 44.4000 },
  'حي الأمير': { lat: 32.0150, lng: 44.3450 },
  'حي السلام': { lat: 32.0250, lng: 44.3550 },
  'المدينة القديمة': { lat: 32.0000, lng: 44.3333 },

  // بغداد ومناطقها
  'بغداد': { lat: 33.3152, lng: 44.3661 },
  'اليرموك': { lat: 33.2989, lng: 44.3458 },
  'المنصور': { lat: 33.3105, lng: 44.3552 },
  'الكرادة': { lat: 33.3012, lng: 44.4285 },
  'زيونة': { lat: 33.3325, lng: 44.4410 },
  'حي الجامعة': { lat: 33.3150, lng: 44.3310 },
  'الأعظمية': { lat: 33.3712, lng: 44.3621 },
  'الكاظمية': { lat: 33.3820, lng: 44.3415 },
  'الدورة': { lat: 33.2500, lng: 44.3800 },
  'العامرية': { lat: 33.3000, lng: 44.2800 },
  'الغزالية': { lat: 33.3400, lng: 44.2700 },
  'السيدية': { lat: 33.2700, lng: 44.3400 },
  'الشعب': { lat: 33.4000, lng: 44.3900 },
  'الشعلة': { lat: 33.3700, lng: 44.3000 },
  'الحرية': { lat: 33.3500, lng: 44.3300 },
  'البلديات': { lat: 33.3300, lng: 44.4700 },
  'الجادرية': { lat: 33.2800, lng: 44.3850 },
  'الحارثية': { lat: 33.3100, lng: 44.3650 },
  'الإسكان': { lat: 33.3350, lng: 44.3500 },
  'الزعفرانية': { lat: 33.2400, lng: 44.4800 },
  'بغداد الجديدة': { lat: 33.3100, lng: 44.4700 },

  // باقي المحافظات
  'البصرة': { lat: 30.5081, lng: 47.7835 },
  'الجبيلة': { lat: 30.5200, lng: 47.8100 },
  'الجزائر': { lat: 30.5100, lng: 47.8200 },
  'الزبير': { lat: 30.3900, lng: 47.7000 },
  'العشار': { lat: 30.5150, lng: 47.8300 },
  'الطويسة': { lat: 30.5120, lng: 47.8150 },
  'بريهة': { lat: 30.5180, lng: 47.8250 },
  'أبي الخصيب': { lat: 30.4500, lng: 47.9800 },

  'أربيل': { lat: 36.1911, lng: 44.0091 },
  'عينكاوة': { lat: 36.2200, lng: 43.9900 },
  'بختياري': { lat: 36.1850, lng: 44.0150 },
  'دريم سيتي': { lat: 36.2100, lng: 44.0050 },
  'روناكي': { lat: 36.1950, lng: 44.0200 },

  'نينوى': { lat: 36.3400, lng: 43.1300 },
  'الموصل': { lat: 36.3400, lng: 43.1300 },
  'الزهور': { lat: 36.3600, lng: 43.1500 },
  'حي السكر': { lat: 36.3700, lng: 43.1600 },
  'المجموعة الثقافية': { lat: 36.3800, lng: 43.1400 },
  'حي الضباط': { lat: 36.3500, lng: 43.1450 },

  'السليمانية': { lat: 35.5570, lng: 45.4350 },
  'سرشنار': { lat: 35.5700, lng: 45.3900 },
  'توي مليك': { lat: 35.5600, lng: 45.4400 },

  'بابل': { lat: 32.4789, lng: 44.4312 },
  'الحلة': { lat: 32.4789, lng: 44.4312 },
  'الحلة المركزية': { lat: 32.4800, lng: 44.4300 },
  'حي الجمعية': { lat: 32.4750, lng: 44.4250 },

  'كركوك': { lat: 35.4681, lng: 44.3922 },
  'رحيماوا': { lat: 35.4850, lng: 44.3800 },
  'طريق بغداد': { lat: 35.4500, lng: 44.4000 },
  'شارع القدس': { lat: 35.4700, lng: 44.3950 },

  'ديالى': { lat: 33.7489, lng: 44.6461 },
  'بعقوبة': { lat: 33.7489, lng: 44.6461 },
  'بعقوبة المركز': { lat: 33.7500, lng: 44.6500 },
  'حي التحرير': { lat: 33.7400, lng: 44.6400 },

  'ميسان': { lat: 31.8400, lng: 47.1400 },
  'العمارة': { lat: 31.8400, lng: 47.1400 },
  'العمارة المركز': { lat: 31.8450, lng: 47.1450 },
  'حي المعلمين': { lat: 31.8350, lng: 47.1350 },

  'ذي قار': { lat: 31.0500, lng: 46.2600 },
  'الناصرية': { lat: 31.0500, lng: 46.2600 },
  'الناصرية المركز': { lat: 31.0550, lng: 46.2650 },
  'حي الإدارة المحلية': { lat: 31.0450, lng: 46.2550 },

  'واسط': { lat: 32.5100, lng: 45.8200 },
  'الكوت': { lat: 32.5100, lng: 45.8200 },

  'المثنى': { lat: 31.3100, lng: 45.2800 },
  'السماوة': { lat: 31.3100, lng: 45.2800 },

  'صلاح الدين': { lat: 34.6000, lng: 43.6800 },
  'تكريت': { lat: 34.6000, lng: 43.6800 },

  'الأنبار': { lat: 33.4200, lng: 43.3000 },
  'الرمادي': { lat: 33.4200, lng: 43.3000 },

  'الديوانية': { lat: 31.9900, lng: 44.9200 },
  'القادسية': { lat: 31.9900, lng: 44.9200 },
};

function getCoordsForTenant(gov: string = '', dist: string = '') {
  const g = gov.trim();
  const d = dist.trim();

  // Try exact district
  if (d && IRAQ_COORDINATES[d]) return IRAQ_COORDINATES[d];

  // Try exact governorate
  if (g && IRAQ_COORDINATES[g]) return IRAQ_COORDINATES[g];

  // Try partial matches
  for (const key of Object.keys(IRAQ_COORDINATES)) {
    if (d && (d.includes(key) || key.includes(d))) return IRAQ_COORDINATES[key];
    if (g && (g.includes(key) || key.includes(g))) return IRAQ_COORDINATES[key];
  }

  // Fallback to Baghdad only if completely unknown
  return IRAQ_COORDINATES['بغداد'];
}

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log(`Found ${tenants.length} tenants in database`);

  for (const t of tenants) {
    const coord = getCoordsForTenant(t.governorate || '', t.district || '');

    await prisma.tenant.update({
      where: { id: t.id },
      data: {
        latitude: coord.lat,
        longitude: coord.lng,
      },
    });

    await prisma.centralSearchIndex.updateMany({
      where: { tenantId: t.id },
      data: {
        latitude: coord.lat,
        longitude: coord.lng,
      },
    });

    console.log(`Updated tenant "${t.name}" (${t.governorate} - ${t.district}) => [${coord.lat}, ${coord.lng}]`);
  }

  console.log('Finished updating coordinates for all Iraqi pharmacies.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
