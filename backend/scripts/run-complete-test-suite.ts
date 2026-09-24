import { execSync } from 'child_process';
import * as path from 'path';

interface SuiteResult {
  name: string;
  command: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

const suites = [
  {
    name: 'المرحلة 1: اختبارات الوحدة والحسابات الصيدلانية (Unit Tests)',
    command: 'npx jest --config ./test/jest-unit.json',
  },
  {
    name: 'المرحلة 2: اختبارات الـ API الشاملة ومزامنة الأسعار والمخزن (API Integration)',
    command: 'npx jest --config ./test/jest-comprehensive.json --runInBand --forceExit',
  },
  {
    name: 'المرحلة 3: اختبارات الأوفلاين والمزامنة المحلية (Offline Local-First & Sync)',
    command: 'npx jest --config ./test/jest-offline.json --runInBand --forceExit',
  },
  {
    name: 'المرحلة 4: سيناريوهات منطق العمل الصيدلاني الـ 11 الحساسة (Business Logic)',
    command: 'npx jest --config ./test/jest-business.json --runInBand --forceExit',
  },
];

async function main() {
  console.log('\n================================================================');
  console.log('🚀 بدء الفحص الشامل لنظام دوائي (Comprehensive System Test Suite)');
  console.log('================================================================\n');

  const results: SuiteResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < suites.length; i++) {
    const s = suites[i];
    console.log(`[${i + 1}/${suites.length}] جاري تشغيل: ${s.name}...`);
    const suiteStart = Date.now();
    try {
      execSync(s.command, {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
      });
      const durationMs = Date.now() - suiteStart;
      results.push({ name: s.name, command: s.command, durationMs, success: true });
      console.log(`✅ اكتملت بنجاح خلال ${(durationMs / 1000).toFixed(2)} ثانية.\n`);
    } catch (err: any) {
      const durationMs = Date.now() - suiteStart;
      results.push({
        name: s.name,
        command: s.command,
        durationMs,
        success: false,
        error: err.message,
      });
      console.error(`❌ فشلت هذه المرحلة بعد ${(durationMs / 1000).toFixed(2)} ثانية.\n`);
    }
  }

  const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalPassed = results.filter((r) => r.success).length;
  const totalFailed = results.filter((r) => !r.success).length;

  console.log('\n================================================================');
  console.log('📊 تقرير الفحص الشامل النهائي لنظام دوائي (Test Scorecard)');
  console.log('================================================================');
  console.log(`⏱️ إجمالي الوقت المستغرق: ${totalDurationSec} ثانية`);
  console.log(`🎯 عدد الحزم الناجحة: ${totalPassed} من أصل ${results.length}`);
  console.log('----------------------------------------------------------------');

  for (const r of results) {
    const icon = r.success ? '🟢 نجاح (PASS)' : '🔴 فشل (FAIL)';
    console.log(`${icon} | ${(r.durationMs / 1000).toFixed(2)}s | ${r.name}`);
  }

  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 تهانينا! اجتاز النظام 100% من جميع الاختبارات البرمجية الصيدلانية بنجاح تام.\n');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Fatal Test Runner Error:', e);
  process.exit(1);
});
