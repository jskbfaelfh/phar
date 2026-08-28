import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// 1. Dataset of 100 Realistic Medicines in Iraqi Pharmacies
const MEDICINES_100 = [
  // مسكنات وخافضات حرارة (Analgesics & Antipyretics)
  { tradeName: 'Panadol Extra', scientificName: 'Paracetamol 500mg + Caffeine 65mg', dosageForm: 'أقراص', strength: '500mg/65mg', manufacturer: 'GSK', barcode: '5054563039835', defaultUnitsPerPack: 2, defaultPrice: 2500 },
  { tradeName: 'Panadol Advance', scientificName: 'Paracetamol 500mg (Optizorb)', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'GSK', barcode: '5000347065932', defaultUnitsPerPack: 2, defaultPrice: 2000 },
  { tradeName: 'Panadol Cold & Flu Day', scientificName: 'Paracetamol + Pseudoephedrine', dosageForm: 'أقراص', strength: '500mg/30mg', manufacturer: 'GSK', barcode: '5000347065949', defaultUnitsPerPack: 2, defaultPrice: 3500 },
  { tradeName: 'Panadol Night', scientificName: 'Paracetamol 500mg + Diphenhydramine 25mg', dosageForm: 'أقراص', strength: '500mg/25mg', manufacturer: 'GSK', barcode: '5000347065956', defaultUnitsPerPack: 2, defaultPrice: 3500 },
  { tradeName: 'Panadol Baby Syrup', scientificName: 'Paracetamol 120mg/5ml', dosageForm: 'شراب أطفال', strength: '120mg/5ml', manufacturer: 'GSK', barcode: '5000347065963', defaultUnitsPerPack: 1, defaultPrice: 3000 },
  { tradeName: 'Profen 400mg', scientificName: 'Ibuprofen', dosageForm: 'أقراص', strength: '400mg', manufacturer: 'Julphar / SDI', barcode: '6291007010452', defaultUnitsPerPack: 3, defaultPrice: 1500 },
  { tradeName: 'Profen 600mg', scientificName: 'Ibuprofen', dosageForm: 'أقراص', strength: '600mg', manufacturer: 'Julphar / SDI', barcode: '6291007010469', defaultUnitsPerPack: 3, defaultPrice: 2000 },
  { tradeName: 'Profen Syrup', scientificName: 'Ibuprofen 100mg/5ml', dosageForm: 'شراب', strength: '100mg/5ml', manufacturer: 'Julphar', barcode: '6291007010476', defaultUnitsPerPack: 1, defaultPrice: 2500 },
  { tradeName: 'Cataflam 50mg', scientificName: 'Diclofenac Potassium', dosageForm: 'حبوب ملبسة', strength: '50mg', manufacturer: 'Novartis', barcode: '7680538910023', defaultUnitsPerPack: 2, defaultPrice: 3500 },
  { tradeName: 'Voltaren 50mg', scientificName: 'Diclofenac Sodium', dosageForm: 'أقراص', strength: '50mg', manufacturer: 'Novartis', barcode: '7680315480014', defaultUnitsPerPack: 2, defaultPrice: 4000 },
  { tradeName: 'Voltaren 100mg Retard', scientificName: 'Diclofenac Sodium SR', dosageForm: 'كبسول ممتد المفعول', strength: '100mg', manufacturer: 'Novartis', barcode: '7680315480021', defaultUnitsPerPack: 2, defaultPrice: 5000 },
  { tradeName: 'Voltaren Emulgel 100g', scientificName: 'Diclofenac Diethylamine Gel', dosageForm: 'جل موضعي', strength: '1.16%', manufacturer: 'GSK / Haleon', barcode: '7680315480038', defaultUnitsPerPack: 1, defaultPrice: 6500 },
  { tradeName: 'Voltaren 75mg/3ml Ampoule', scientificName: 'Diclofenac Sodium Inj', dosageForm: 'أمبولات حقن', strength: '75mg/3ml', manufacturer: 'Novartis', barcode: '7680315480045', defaultUnitsPerPack: 5, defaultPrice: 7500 },
  { tradeName: 'Ponstan Forte 500mg', scientificName: 'Mefenamic Acid', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'Pfizer', barcode: '5415062301119', defaultUnitsPerPack: 2, defaultPrice: 3000 },
  { tradeName: 'Doloraz 500mg', scientificName: 'Paracetamol', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'SDI Samarra', barcode: '6281002938015', defaultUnitsPerPack: 2, defaultPrice: 1000 },
  { tradeName: 'Meloxicam 15mg', scientificName: 'Meloxicam', dosageForm: 'أقراص', strength: '15mg', manufacturer: 'Hikma', barcode: '6251001029384', defaultUnitsPerPack: 2, defaultPrice: 3000 },
  { tradeName: 'Celebrex 200mg', scientificName: 'Celecoxib', dosageForm: 'كبسول', strength: '200mg', manufacturer: 'Pfizer', barcode: '5415062301225', defaultUnitsPerPack: 2, defaultPrice: 12000 },
  { tradeName: 'Arcoxia 90mg', scientificName: 'Etoricoxib', dosageForm: 'أقراص', strength: '90mg', manufacturer: 'MSD', barcode: '5000158061117', defaultUnitsPerPack: 2, defaultPrice: 14000 },
  { tradeName: 'Tramal 50mg', scientificName: 'Tramadol HCl', dosageForm: 'كبسول', strength: '50mg', manufacturer: 'Grunenthal', barcode: '4019367001018', defaultUnitsPerPack: 2, defaultPrice: 8000 },

  // مضادات حيوية والتهابات (Antibiotics & Anti-infectives)
  { tradeName: 'Amoxil 500mg', scientificName: 'Amoxicillin Trihydrate', dosageForm: 'كبسول', strength: '500mg', manufacturer: 'GSK / SDI', barcode: '6281002938121', defaultUnitsPerPack: 2, defaultPrice: 2500 },
  { tradeName: 'Augmentin 1g', scientificName: 'Amoxicillin + Clavulanic Acid', dosageForm: 'أقراص', strength: '1g (875/125mg)', manufacturer: 'GSK', barcode: '5000158068994', defaultUnitsPerPack: 2, defaultPrice: 7500 },
  { tradeName: 'Augmentin 625mg', scientificName: 'Amoxicillin + Clavulanate', dosageForm: 'أقراص', strength: '625mg', manufacturer: 'GSK', barcode: '5000158068987', defaultUnitsPerPack: 2, defaultPrice: 6000 },
  { tradeName: 'Augmentin Susp 457mg', scientificName: 'Amoxicillin + Clavulanate Susp', dosageForm: 'معلق شراب أطفال', strength: '457mg/5ml', manufacturer: 'GSK', barcode: '5000158068970', defaultUnitsPerPack: 1, defaultPrice: 6500 },
  { tradeName: 'Curam 1g', scientificName: 'Amoxicillin + Clavulanic Acid', dosageForm: 'أقراص', strength: '1000mg', manufacturer: 'Sandoz', barcode: '7680538910115', defaultUnitsPerPack: 2, defaultPrice: 6500 },
  { tradeName: 'Zithromax 500mg', scientificName: 'Azithromycin', dosageForm: 'كبسول', strength: '500mg', manufacturer: 'Pfizer', barcode: '5415062301331', defaultUnitsPerPack: 1, defaultPrice: 6000 },
  { tradeName: 'Zithromax Susp 200mg', scientificName: 'Azithromycin Susp', dosageForm: 'شراب معلق', strength: '200mg/5ml', manufacturer: 'Pfizer', barcode: '5415062301348', defaultUnitsPerPack: 1, defaultPrice: 7000 },
  { tradeName: 'Keflex 500mg', scientificName: 'Cephalexin', dosageForm: 'كبسول', strength: '500mg', manufacturer: 'Eli Lilly', barcode: '5000158061223', defaultUnitsPerPack: 2, defaultPrice: 3500 },
  { tradeName: 'Suprax 400mg', scientificName: 'Cefixime', dosageForm: 'كبسول', strength: '400mg', manufacturer: 'Hikma / Astellas', barcode: '6251001029490', defaultUnitsPerPack: 1, defaultPrice: 9000 },
  { tradeName: 'Ciprobay 500mg', scientificName: 'Ciprofloxacin HCl', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'Bayer', barcode: '4000570010012', defaultUnitsPerPack: 1, defaultPrice: 5500 },
  { tradeName: 'Ciprocin 500mg', scientificName: 'Ciprofloxacin', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'Hikma', barcode: '6251001029506', defaultUnitsPerPack: 1, defaultPrice: 3000 },
  { tradeName: 'Tavanic 500mg', scientificName: 'Levofloxacin', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'Sanofi', barcode: '3582910034119', defaultUnitsPerPack: 1, defaultPrice: 11000 },
  { tradeName: 'Flagyl 500mg', scientificName: 'Metronidazole', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'Sanofi', barcode: '3582910034812', defaultUnitsPerPack: 2, defaultPrice: 2000 },
  { tradeName: 'Flagyl Susp 125mg', scientificName: 'Metronidazole Benzoate', dosageForm: 'شراب', strength: '125mg/5ml', manufacturer: 'Sanofi', barcode: '3582910034829', defaultUnitsPerPack: 1, defaultPrice: 2500 },
  { tradeName: 'Klacid 500mg', scientificName: 'Clarithromycin', dosageForm: 'حبوب ملبسة', strength: '500mg', manufacturer: 'Abbott', barcode: '5000158061339', defaultUnitsPerPack: 2, defaultPrice: 13500 },
  { tradeName: 'Rocephin 1g IV/IM', scientificName: 'Ceftriaxone Sodium', dosageForm: 'فيال حقن', strength: '1g', manufacturer: 'Roche', barcode: '7680538910221', defaultUnitsPerPack: 1, defaultPrice: 5000 },
  { tradeName: 'Claforan 1g', scientificName: 'Cefotaxime Sodium', dosageForm: 'فيال حقن', strength: '1g', manufacturer: 'Sanofi', barcode: '3582910034331', defaultUnitsPerPack: 1, defaultPrice: 4000 },
  { tradeName: 'Bactrim DS', scientificName: 'Sulfamethoxazole + Trimethoprim', dosageForm: 'أقراص', strength: '800/160mg', manufacturer: 'Roche', barcode: '7680538910337', defaultUnitsPerPack: 2, defaultPrice: 3000 },
  { tradeName: 'Daktarin Oral Gel', scientificName: 'Miconazole Nitrate', dosageForm: 'جل فموي للفطريات', strength: '20mg/g', manufacturer: 'Janssen', barcode: '5415062301447', defaultUnitsPerPack: 1, defaultPrice: 4500 },
  { tradeName: 'Diflucan 150mg', scientificName: 'Fluconazole', dosageForm: 'كبسول', strength: '150mg', manufacturer: 'Pfizer', barcode: '5415062301553', defaultUnitsPerPack: 1, defaultPrice: 8500 },

  // الجهاز الهضمي والمعدة (Gastrointestinal)
  { tradeName: 'Nexium 40mg', scientificName: 'Esomeprazole Magnesium', dosageForm: 'أقراص مقاومة للمعدة', strength: '40mg', manufacturer: 'AstraZeneca', barcode: '7323190014022', defaultUnitsPerPack: 2, defaultPrice: 11000 },
  { tradeName: 'Nexium 20mg', scientificName: 'Esomeprazole', dosageForm: 'أقراص', strength: '20mg', manufacturer: 'AstraZeneca', barcode: '7323190014015', defaultUnitsPerPack: 2, defaultPrice: 9500 },
  { tradeName: 'Controloc 40mg', scientificName: 'Pantoprazole Sodium', dosageForm: 'أقراص', strength: '40mg', manufacturer: 'Takeda', barcode: '4022536101118', defaultUnitsPerPack: 2, defaultPrice: 8000 },
  { tradeName: 'Omeprazole 20mg', scientificName: 'Omeprazole', dosageForm: 'كبسول', strength: '20mg', manufacturer: 'SDI / Hikma', barcode: '6281002938220', defaultUnitsPerPack: 2, defaultPrice: 2000 },
  { tradeName: 'Gaviscon Double Action', scientificName: 'Sodium Alginate + Calcium Carb', dosageForm: 'شراب معلق للمعدة', strength: '200ml', manufacturer: 'Reckitt', barcode: '5000158061445', defaultUnitsPerPack: 1, defaultPrice: 6500 },
  { tradeName: 'Gaviscon Chewable Tabs', scientificName: 'Sodium Alginate', dosageForm: 'أقراص مضغ', strength: '250mg', manufacturer: 'Reckitt', barcode: '5000158061452', defaultUnitsPerPack: 2, defaultPrice: 5000 },
  { tradeName: 'Motilium 10mg', scientificName: 'Domperidone', dosageForm: 'أقراص', strength: '10mg', manufacturer: 'Janssen', barcode: '5415062301669', defaultUnitsPerPack: 3, defaultPrice: 4000 },
  { tradeName: 'Motilium Syrup', scientificName: 'Domperidone 1mg/ml', dosageForm: 'شراب غثيان', strength: '1mg/ml', manufacturer: 'Janssen', barcode: '5415062301676', defaultUnitsPerPack: 1, defaultPrice: 4500 },
  { tradeName: 'Plasil 10mg', scientificName: 'Metoclopramide HCl', dosageForm: 'أقراص', strength: '10mg', manufacturer: 'Sanofi', barcode: '3582910034447', defaultUnitsPerPack: 2, defaultPrice: 1500 },
  { tradeName: 'Buscopan 10mg', scientificName: 'Hyoscine Butylbromide', dosageForm: 'أقراص مغص', strength: '10mg', manufacturer: 'Sanofi', barcode: '3582910034553', defaultUnitsPerPack: 2, defaultPrice: 2500 },
  { tradeName: 'Buscopan Plus', scientificName: 'Hyoscine 10mg + Paracetamol 500mg', dosageForm: 'أقراص مغص ومسكن', strength: '10/500mg', manufacturer: 'Sanofi', barcode: '3582910034560', defaultUnitsPerPack: 2, defaultPrice: 3500 },
  { tradeName: 'Duspatalin 135mg', scientificName: 'Mebeverine HCl', dosageForm: 'أقراص قولون', strength: '135mg', manufacturer: 'Abbott', barcode: '5000158061551', defaultUnitsPerPack: 3, defaultPrice: 6000 },
  { tradeName: 'Duspatalin Retard 200mg', scientificName: 'Mebeverine SR', dosageForm: 'كبسول ممتد المفعول', strength: '200mg', manufacturer: 'Abbott', barcode: '5000158061568', defaultUnitsPerPack: 3, defaultPrice: 8500 },
  { tradeName: 'Colofac 135mg', scientificName: 'Mebeverine', dosageForm: 'أقراص', strength: '135mg', manufacturer: 'Viatris', barcode: '5000158061575', defaultUnitsPerPack: 2, defaultPrice: 5000 },
  { tradeName: 'Imodium 2mg', scientificName: 'Loperamide HCl', dosageForm: 'كبسول إسهال', strength: '2mg', manufacturer: 'Janssen', barcode: '5415062301775', defaultUnitsPerPack: 1, defaultPrice: 3000 },
  { tradeName: 'Smecta Sachets', scientificName: 'Diosmectite', dosageForm: 'أكياس فوارة', strength: '3g', manufacturer: 'Ipsen', barcode: '3582910034669', defaultUnitsPerPack: 3, defaultPrice: 6000 },
  { tradeName: 'Duphalac Syrup', scientificName: 'Lactulose 66.7g/100ml', dosageForm: 'شراب ملين', strength: '200ml', manufacturer: 'Abbott', barcode: '5000158061667', defaultUnitsPerPack: 1, defaultPrice: 5500 },
  { tradeName: 'Dulcolax 5mg', scientificName: 'Bisacodyl', dosageForm: 'أقراص ملينة', strength: '5mg', manufacturer: 'Sanofi', barcode: '3582910034775', defaultUnitsPerPack: 2, defaultPrice: 2000 },

  // أمراض القلب والضغط والدهون (Cardiology & Hypertension & Lipids)
  { tradeName: 'Concor 5mg', scientificName: 'Bisoprolol Fumarate', dosageForm: 'أقراص', strength: '5mg', manufacturer: 'Merck', barcode: '4022536109923', defaultUnitsPerPack: 3, defaultPrice: 5500 },
  { tradeName: 'Concor 2.5mg', scientificName: 'Bisoprolol', dosageForm: 'أقراص', strength: '2.5mg', manufacturer: 'Merck', barcode: '4022536109916', defaultUnitsPerPack: 3, defaultPrice: 5000 },
  { tradeName: 'Concor 10mg', scientificName: 'Bisoprolol', dosageForm: 'أقراص', strength: '10mg', manufacturer: 'Merck', barcode: '4022536109930', defaultUnitsPerPack: 3, defaultPrice: 7000 },
  { tradeName: 'Lipitor 20mg', scientificName: 'Atorvastatin Calcium', dosageForm: 'أقراص', strength: '20mg', manufacturer: 'Pfizer', barcode: '5415062301928', defaultUnitsPerPack: 3, defaultPrice: 9000 },
  { tradeName: 'Lipitor 40mg', scientificName: 'Atorvastatin', dosageForm: 'أقراص', strength: '40mg', manufacturer: 'Pfizer', barcode: '5415062301935', defaultUnitsPerPack: 3, defaultPrice: 12500 },
  { tradeName: 'Crestor 10mg', scientificName: 'Rosuvastatin Calcium', dosageForm: 'أقراص', strength: '10mg', manufacturer: 'AstraZeneca', barcode: '7323190014114', defaultUnitsPerPack: 2, defaultPrice: 10000 },
  { tradeName: 'Crestor 20mg', scientificName: 'Rosuvastatin', dosageForm: 'أقراص', strength: '20mg', manufacturer: 'AstraZeneca', barcode: '7323190014121', defaultUnitsPerPack: 2, defaultPrice: 14000 },
  { tradeName: 'Norvasc 5mg', scientificName: 'Amlodipine Besylate', dosageForm: 'أقراص', strength: '5mg', manufacturer: 'Pfizer', barcode: '5415062301881', defaultUnitsPerPack: 3, defaultPrice: 7500 },
  { tradeName: 'Norvasc 10mg', scientificName: 'Amlodipine', dosageForm: 'أقراص', strength: '10mg', manufacturer: 'Pfizer', barcode: '5415062301898', defaultUnitsPerPack: 3, defaultPrice: 9500 },
  { tradeName: 'Exforge 5/160mg', scientificName: 'Amlodipine + Valsartan', dosageForm: 'أقراص', strength: '5/160mg', manufacturer: 'Novartis', barcode: '7680538910443', defaultUnitsPerPack: 2, defaultPrice: 15000 },
  { tradeName: 'Exforge 10/160mg', scientificName: 'Amlodipine + Valsartan', dosageForm: 'أقراص', strength: '10/160mg', manufacturer: 'Novartis', barcode: '7680538910450', defaultUnitsPerPack: 2, defaultPrice: 16500 },
  { tradeName: 'Diovan 80mg', scientificName: 'Valsartan', dosageForm: 'أقراص', strength: '80mg', manufacturer: 'Novartis', barcode: '7680538910559', defaultUnitsPerPack: 2, defaultPrice: 11000 },
  { tradeName: 'Co-Diovan 160/12.5mg', scientificName: 'Valsartan + Hydrochlorothiazide', dosageForm: 'أقراص', strength: '160/12.5mg', manufacturer: 'Novartis', barcode: '7680538910566', defaultUnitsPerPack: 2, defaultPrice: 13500 },
  { tradeName: 'Plavix 75mg', scientificName: 'Clopidogrel Bisulfate', dosageForm: 'أقراص مانع تجلط', strength: '75mg', manufacturer: 'Sanofi', barcode: '3582910034998', defaultUnitsPerPack: 2, defaultPrice: 16000 },
  { tradeName: 'Aspirin Protect 100mg', scientificName: 'Acetylsalicylic Acid', dosageForm: 'أقراص مسيلة للدم', strength: '100mg', manufacturer: 'Bayer', barcode: '4000570010111', defaultUnitsPerPack: 3, defaultPrice: 3000 },
  { tradeName: 'Lasix 40mg', scientificName: 'Furosemide', dosageForm: 'أقراص مدرر بول', strength: '40mg', manufacturer: 'Sanofi', barcode: '3582910034002', defaultUnitsPerPack: 2, defaultPrice: 2000 },
  { tradeName: 'Aldactone 25mg', scientificName: 'Spironolactone', dosageForm: 'أقراص', strength: '25mg', manufacturer: 'Pfizer', barcode: '5415062301997', defaultUnitsPerPack: 2, defaultPrice: 3500 },

  // السكري والغدد الصماء (Diabetes & Endocrine)
  { tradeName: 'Glucophage 500mg', scientificName: 'Metformin HCl', dosageForm: 'أقراص', strength: '500mg', manufacturer: 'Merck', barcode: '4022536102224', defaultUnitsPerPack: 5, defaultPrice: 3500 },
  { tradeName: 'Glucophage 1000mg', scientificName: 'Metformin HCl', dosageForm: 'أقراص', strength: '1000mg', manufacturer: 'Merck', barcode: '4022536102231', defaultUnitsPerPack: 3, defaultPrice: 4500 },
  { tradeName: 'Glucophage XR 750mg', scientificName: 'Metformin Extended Release', dosageForm: 'أقراص ممتدة المفعول', strength: '750mg', manufacturer: 'Merck', barcode: '4022536102248', defaultUnitsPerPack: 3, defaultPrice: 5500 },
  { tradeName: 'Januvia 100mg', scientificName: 'Sitagliptin', dosageForm: 'أقراص', strength: '100mg', manufacturer: 'MSD', barcode: '5000158061773', defaultUnitsPerPack: 2, defaultPrice: 22000 },
  { tradeName: 'Janumet 50/1000mg', scientificName: 'Sitagliptin + Metformin', dosageForm: 'أقراص', strength: '50/1000mg', manufacturer: 'MSD', barcode: '5000158061780', defaultUnitsPerPack: 4, defaultPrice: 26000 },
  { tradeName: 'Diamicron MR 60mg', scientificName: 'Gliclazide Modified Release', dosageForm: 'أقراص', strength: '60mg', manufacturer: 'Servier', barcode: '3582910034126', defaultUnitsPerPack: 2, defaultPrice: 7000 },
  { tradeName: 'Amaryl 2mg', scientificName: 'Glimepiride', dosageForm: 'أقراص', strength: '2mg', manufacturer: 'Sanofi', barcode: '3582910034225', defaultUnitsPerPack: 3, defaultPrice: 4500 },
  { tradeName: 'Amaryl 3mg', scientificName: 'Glimepiride', dosageForm: 'أقراص', strength: '3mg', manufacturer: 'Sanofi', barcode: '3582910034232', defaultUnitsPerPack: 3, defaultPrice: 5000 },
  { tradeName: 'Lantus SoloStar 100U', scientificName: 'Insulin Glargine Pen', dosageForm: 'أقلام إنسولين', strength: '100U/ml', manufacturer: 'Sanofi', barcode: '3582910034981', defaultUnitsPerPack: 5, defaultPrice: 45000 },
  { tradeName: 'Novorapid FlexPen', scientificName: 'Insulin Aspart', dosageForm: 'أقلام إنسولين سريع', strength: '100U/ml', manufacturer: 'Novo Nordisk', barcode: '5702190010014', defaultUnitsPerPack: 5, defaultPrice: 42000 },
  { tradeName: 'Euthyrox 50mcg', scientificName: 'Levothyroxine Sodium', dosageForm: 'حبوب غدة درقية', strength: '50mcg', manufacturer: 'Merck', barcode: '4022536103330', defaultUnitsPerPack: 4, defaultPrice: 4000 },
  { tradeName: 'Euthyrox 100mcg', scientificName: 'Levothyroxine', dosageForm: 'حبوب غدة', strength: '100mcg', manufacturer: 'Merck', barcode: '4022536103347', defaultUnitsPerPack: 4, defaultPrice: 5000 },

  // الحساسية والجهاز التنفسي (Allergy & Respiratory)
  { tradeName: 'Zyrtec 10mg', scientificName: 'Cetirizine Di-HCl', dosageForm: 'أقراص حساسية', strength: '10mg', manufacturer: 'GSK / UCB', barcode: '5000158061889', defaultUnitsPerPack: 2, defaultPrice: 3500 },
  { tradeName: 'Zyrtec Drops', scientificName: 'Cetirizine 10mg/ml', dosageForm: 'قطرات حساسية أطفال', strength: '10mg/ml', manufacturer: 'GSK', barcode: '5000158061896', defaultUnitsPerPack: 1, defaultPrice: 4000 },
  { tradeName: 'Claritine 10mg', scientificName: 'Loratadine', dosageForm: 'أقراص', strength: '10mg', manufacturer: 'Bayer', barcode: '4000570010227', defaultUnitsPerPack: 2, defaultPrice: 4000 },
  { tradeName: 'Aerius 5mg', scientificName: 'Desloratadine', dosageForm: 'أقراص حساسية غير منومة', strength: '5mg', manufacturer: 'Bayer', barcode: '4000570010333', defaultUnitsPerPack: 2, defaultPrice: 7500 },
  { tradeName: 'Ventolin Evohaler 100mcg', scientificName: 'Salbutamol Inhaler', dosageForm: 'بخاخ ربو', strength: '100mcg/dose', manufacturer: 'GSK', barcode: '5000347065000', defaultUnitsPerPack: 1, defaultPrice: 4500 },
  { tradeName: 'Symbicort 160/4.5 Turbuhaler', scientificName: 'Budesonide + Formoterol', dosageForm: 'بخاخ استنشاق للربو', strength: '160/4.5mcg', manufacturer: 'AstraZeneca', barcode: '7323190014220', defaultUnitsPerPack: 1, defaultPrice: 28000 },
  { tradeName: 'Pulmicort Respules 0.5mg', scientificName: 'Budesonide Nebulising Susp', dosageForm: 'أمبولات جهاز تبخير', strength: '0.5mg/2ml', manufacturer: 'AstraZeneca', barcode: '7323190014336', defaultUnitsPerPack: 5, defaultPrice: 18000 },
  { tradeName: 'Solmucol 600mg', scientificName: 'N-Acetylcysteine', dosageForm: 'أكياس فوارة للبلغم', strength: '600mg', manufacturer: 'IBSA', barcode: '7680538910665', defaultUnitsPerPack: 2, defaultPrice: 6000 },
  { tradeName: 'Prospan Syrup', scientificName: 'Dried Ivy Leaf Extract', dosageForm: 'شراب أعشاب للسعال', strength: '100ml', manufacturer: 'Engelhard', barcode: '4019367001223', defaultUnitsPerPack: 1, defaultPrice: 6500 },
  { tradeName: 'Otrivin Adult 0.1%', scientificName: 'Xylometazoline HCl', dosageForm: 'بخاخ أنف للاحتقان', strength: '0.1%', manufacturer: 'GSK / Haleon', barcode: '7680538910771', defaultUnitsPerPack: 1, defaultPrice: 3000 },
  { tradeName: 'Otrivin Ped 0.05%', scientificName: 'Xylometazoline Drops', dosageForm: 'قطرات أنف للأطفال', strength: '0.05%', manufacturer: 'GSK', barcode: '7680538910788', defaultUnitsPerPack: 1, defaultPrice: 2500 },

  // الفيتامينات والمكملات الغذائية (Vitamins & Supplements)
  { tradeName: 'Vitamin D3 50,000 IU', scientificName: 'Cholecalciferol', dosageForm: 'كبسول جيلاتيني', strength: '50000 IU', manufacturer: 'Jamieson / Euro OTC', barcode: '6251001029667', defaultUnitsPerPack: 1, defaultPrice: 6000 },
  { tradeName: 'Vitamin D3 200,000 IU Ampoule', scientificName: 'Cholecalciferol Inj', dosageForm: 'أمبولة شرب أو حقن', strength: '200000 IU/ml', manufacturer: 'Rotexmedica', barcode: '4022536104446', defaultUnitsPerPack: 1, defaultPrice: 3500 },
  { tradeName: 'Redoxon Vitamin C 1000mg', scientificName: 'Ascorbic Acid + Zinc', dosageForm: 'أقراص فوارة برتقال', strength: '1000mg', manufacturer: 'Bayer', barcode: '4000570010449', defaultUnitsPerPack: 1, defaultPrice: 4500 },
  { tradeName: 'Neurobion Forte Tabs', scientificName: 'Vitamin B1 + B6 + B12', dosageForm: 'حبوب مقوي أعصاب', strength: 'B-Complex', manufacturer: 'P&G / Merck', barcode: '4022536105552', defaultUnitsPerPack: 3, defaultPrice: 4000 },
  { tradeName: 'Neurobion Ampoules', scientificName: 'Vitamin B1, B6, B12 Inj', dosageForm: 'أمبولات حقن عضل', strength: '3ml', manufacturer: 'Merck', barcode: '4022536105569', defaultUnitsPerPack: 3, defaultPrice: 6000 },
  { tradeName: 'Osteocare Original', scientificName: 'Calcium + Magnesium + Zinc + Vit D3', dosageForm: 'أقراص كالسيوم', strength: 'Combined', manufacturer: 'Vitabiotics', barcode: '5021265220018', defaultUnitsPerPack: 3, defaultPrice: 9500 },
  { tradeName: 'Feroglobin B12 Capsules', scientificName: 'Iron + Zinc + B-Complex + Folic Acid', dosageForm: 'كبسول حديد لطيف', strength: 'Nutritional Iron', manufacturer: 'Vitabiotics', barcode: '5021265220025', defaultUnitsPerPack: 3, defaultPrice: 8500 },
  { tradeName: 'Fefol Spansule', scientificName: 'Ferrous Sulfate + Folic Acid', dosageForm: 'كبسول حديد وحامض فوليك', strength: '150/0.5mg', manufacturer: 'GSK', barcode: '5000347065116', defaultUnitsPerPack: 3, defaultPrice: 4500 },
  { tradeName: 'Omega 3 Fish Oil 1000mg', scientificName: 'EPA + DHA Fatty Acids', dosageForm: 'كبسول زيت سمك', strength: '1000mg', manufacturer: 'Nature Made / 21st Century', barcode: '031604020014', defaultUnitsPerPack: 1, defaultPrice: 12000 },
  { tradeName: 'Zinc 50mg', scientificName: 'Zinc Gluconate', dosageForm: 'أقراص زنك', strength: '50mg', manufacturer: '21st Century', barcode: '031604020021', defaultUnitsPerPack: 1, defaultPrice: 4000 },
];

// 2. Dataset of 60 Pharmacies Across Iraq Governorates
const PHARMACIES_60 = [
  // بغداد (20 صيدلية)
  { name: 'صيدلية اليرموك الحديثة', governorate: 'بغداد', district: 'اليرموك', addressDetails: 'شارع الأربع شوارع - مجاور مجمع الأطباء', phone: '07701234561', lat: 33.3012, lng: 44.3541 },
  { name: 'صيدلية المنصور الدولية', governorate: 'بغداد', district: 'المنصور', addressDetails: 'شارع 14 رمضان - قرب مطعم الساعة', phone: '07702345672', lat: 33.3125, lng: 44.3522 },
  { name: 'صيدلية زيونة النموذجية', governorate: 'بغداد', district: 'زيونة', addressDetails: 'شارع الربيعي - مقابل مجمع كولدن سيتي', phone: '07703456783', lat: 33.3289, lng: 44.4410 },
  { name: 'صيدلية الكرادة الشرقية', governorate: 'بغداد', district: 'الكرادة', addressDetails: 'شارع الكرادة داخل - تقاطع سبع قصور', phone: '07704567894', lat: 33.3080, lng: 44.4250 },
  { name: 'صيدلية الجادرية التخصصية', governorate: 'بغداد', district: 'الجادرية', addressDetails: 'قرب مجمع الكليات - شارع النهر', phone: '07705678905', lat: 33.2780, lng: 44.3850 },
  { name: 'صيدلية الأعظمية المركزية', governorate: 'بغداد', district: 'الأعظمية', addressDetails: 'شارع عمر بن عبد العزيز - قرب ساحة عنتر', phone: '07706789016', lat: 33.3680, lng: 44.3620 },
  { name: 'صيدلية الكاظمية المقدسة', governorate: 'بغداد', district: 'الكاظمية', addressDetails: 'شارع باب المراد - مقابل العيادات الطبية', phone: '07707890127', lat: 33.3820, lng: 44.3410 },
  { name: 'صيدلية الشعب المركزية', governorate: 'بغداد', district: 'الشعب', addressDetails: 'شارع عثمان بن عفان - سوق 4000', phone: '07708901238', lat: 33.4120, lng: 44.4020 },
  { name: 'صيدلية الغزالية الطبية', governorate: 'بغداد', district: 'الغزالية', addressDetails: 'شارع الميثاق - قرب تقاطع الدلة', phone: '07709012349', lat: 33.3350, lng: 44.2710 },
  { name: 'صيدلية السيدية الحديثة', governorate: 'بغداد', district: 'السيدية', addressDetails: 'الشارع التجاري - قرب مثلجات الرواد', phone: '07710123450', lat: 33.2510, lng: 44.3480 },
  { name: 'صيدلية الحارثية التخصصية', governorate: 'بغداد', district: 'الحارثية', addressDetails: 'شارع الكندي - عمارة الأطباء الملكية', phone: '07711234561', lat: 33.3100, lng: 44.3700 },
  { name: 'صيدلية بغداد الجديدة', governorate: 'بغداد', district: 'بغداد الجديدة', addressDetails: 'الشارع العام - مقابل السوق المركزي', phone: '07712345672', lat: 33.2980, lng: 44.4750 },
  { name: 'صيدلية الدورة المركزية', governorate: 'بغداد', district: 'الدورة', addressDetails: 'شارع أبو طيارة - مجاور المجمع الطبي', phone: '07713456783', lat: 33.2620, lng: 44.4100 },
  { name: 'صيدلية حي الجامعة', governorate: 'بغداد', district: 'حي الجامعة', addressDetails: 'شارع الربيع - قرب صقر قريش', phone: '07714567894', lat: 33.3210, lng: 44.3090 },
  { name: 'صيدلية البلديات الحديثة', governorate: 'بغداد', district: 'البلديات', addressDetails: 'قرب جامع السامرائي - الشارع الرئيسي', phone: '07715678905', lat: 33.3310, lng: 44.4920 },
  { name: 'صيدلية الشعلة الطبية', governorate: 'بغداد', district: 'الشعلة', addressDetails: 'شارع 60 - قرب المستوصف الصحي', phone: '07716789016', lat: 33.3750, lng: 44.2980 },
  { name: 'صيدلية الزعفرانية الكبرى', governorate: 'بغداد', district: 'الزعفرانية', addressDetails: 'شارع المعهد الفني - قرب ساحة المصنع', phone: '07717890127', lat: 33.2380, lng: 44.4890 },
  { name: 'صيدلية الحرية النموذجية', governorate: 'بغداد', district: 'الحرية', addressDetails: 'دائرة المختار - شارع المدارس', phone: '07718901238', lat: 33.3550, lng: 44.3310 },
  { name: 'صيدلية الإسكان التخصصية', governorate: 'بغداد', district: 'الإسكان', addressDetails: 'شارع مستشفى الطفل المركزي - مجمع الشفاء', phone: '07719012349', lat: 33.3320, lng: 44.3410 },
  { name: 'صيدلية العامرية المركزية', governorate: 'بغداد', district: 'العامرية', addressDetails: 'شارع المنظمة - قرب تقاطع العمل الشعبي', phone: '07720123450', lat: 33.3050, lng: 44.2810 },

  // البصرة (7 صيدليات)
  { name: 'صيدلية العشار المركزية', governorate: 'البصرة', district: 'العشار', addressDetails: 'شارع الكويت - مقابل مجمع النور الطبي', phone: '07801122334', lat: 30.5081, lng: 47.8312 },
  { name: 'صيدلية الجزائر الحديثة', governorate: 'البصرة', district: 'الجزائر', addressDetails: 'شارع 14 تموز - قرب مستشفى البصرة التخصصي', phone: '07802233445', lat: 30.5190, lng: 47.8150 },
  { name: 'صيدلية الجبيلة الدولية', governorate: 'البصرة', district: 'الجبيلة', addressDetails: 'الشارع التجاري - قرب تايمز سكوير مول', phone: '07803344556', lat: 30.5340, lng: 47.7980 },
  { name: 'صيدلية بريهة الطبية', governorate: 'البصرة', district: 'بريهة', addressDetails: 'شارع الاستقلال - مجمع الرافدين الطبي', phone: '07804455667', lat: 30.5120, lng: 47.8220 },
  { name: 'صيدلية الطويسة النموذجية', governorate: 'البصرة', district: 'الطويسة', addressDetails: 'قرب جامع البصرة الكبير - شارع الكورنيش', phone: '07805566778', lat: 30.5020, lng: 47.8410 },
  { name: 'صيدلية أبي الخصيب', governorate: 'البصرة', district: 'أبي الخصيب', addressDetails: 'الشارع العام - سوق أبي الخصيب المركزي', phone: '07806677889', lat: 30.4350, lng: 47.9620 },
  { name: 'صيدلية الزبير المركزية', governorate: 'البصرة', district: 'الزبير', addressDetails: 'شارع الكوت - قرب سوق الزبير القديم', phone: '07807788990', lat: 30.3920, lng: 47.7010 },

  // أربيل (5 صيدليات)
  { name: 'صيدلية عينكاوة الحديثة', governorate: 'أربيل', district: 'عينكاوة', addressDetails: 'شارع المنتزه - قرب مجمع مارينا الطبي', phone: '07501239871', lat: 36.2250, lng: 43.9920 },
  { name: 'صيدلية بختياري الدولية', governorate: 'أربيل', district: 'بختياري', addressDetails: 'شارع 100 متري - قرب مستشفى باكي', phone: '07502349872', lat: 36.1950, lng: 44.0210 },
  { name: 'صيدلية روناكي النموذجية', governorate: 'أربيل', district: 'روناكي', addressDetails: 'شارع شورش - مقابل فندق أربيل الدولي', phone: '07503459873', lat: 36.1880, lng: 44.0320 },
  { name: 'صيدلية الإسكان أربيل', governorate: 'أربيل', district: 'الإسكان', addressDetails: 'شارع 60 متري - قرب العيادات المركزية', phone: '07504569874', lat: 36.1750, lng: 44.0080 },
  { name: 'صيدلية دريم سيتي', governorate: 'أربيل', district: 'دريم سيتي', addressDetails: 'بوابة دريم سيتي - شارع كولان', phone: '07505679875', lat: 36.2080, lng: 43.9850 },

  // النجف الأشرف (5 صيدليات)
  { name: 'صيدلية الغري التخصصية', governorate: 'النجف', district: 'المدينة القديمة', addressDetails: 'شارع الصادق - قرب العتبة العلوية المقدسة', phone: '07811234501', lat: 31.9960, lng: 44.3140 },
  { name: 'صيدلية الكوفة المركزية', governorate: 'النجف', district: 'الكوفة', addressDetails: 'شارع السفير - قرب مسجد الكوفة المعظم', phone: '07812345602', lat: 32.0290, lng: 44.4010 },
  { name: 'صيدلية الأمير النموذجية', governorate: 'النجف', district: 'حي الأمير', addressDetails: 'شارع الروان - مجمع الحياة الطبي', phone: '07813456703', lat: 32.0120, lng: 44.3350 },
  { name: 'صيدلية الإسكان النجف', governorate: 'النجف', district: 'الإسكان', addressDetails: 'شارع الحزام الناقل - مجاور مستشفى الصدر', phone: '07814567804', lat: 32.0220, lng: 44.3480 },
  { name: 'صيدلية السلام الطبية', governorate: 'النجف', district: 'حي السلام', addressDetails: 'شارع النجف كربلاء - قرب مدينة الألعاب', phone: '07815678905', lat: 32.0450, lng: 44.3210 },

  // كربلاء المقدسة (4 صيدليات)
  { name: 'صيدلية العباس المركزية', governorate: 'كربلاء', district: 'البلدية', addressDetails: 'شارع الإمام علي - مجاور العيادات الطبية', phone: '07821122301', lat: 32.6160, lng: 44.0320 },
  { name: 'صيدلية الحسين التخصصية', governorate: 'كربلاء', district: 'الإسكان', addressDetails: 'شارع مستشفى الحسين التعليمي - مجمع الشفاء', phone: '07822233402', lat: 32.6050, lng: 44.0210 },
  { name: 'صيدلية سيف سعد الحديثة', governorate: 'كربلاء', district: 'سيف سعد', addressDetails: 'الشارع التجاري - قرب تقاطع المعلمين', phone: '07823344503', lat: 32.5920, lng: 44.0150 },
  { name: 'صيدلية حي الحسين', governorate: 'كربلاء', district: 'حي الحسين', addressDetails: 'شارع المدارس - مقابل مركز الرعاية الصحية', phone: '07824455604', lat: 32.6280, lng: 44.0040 },

  // نينوى / الموصل (4 صيدليات)
  { name: 'صيدلية نينوى الكبرى', governorate: 'نينوى', district: 'الزهور', addressDetails: 'شارع الزهور التجاري - مجمع الأطباء الدولي', phone: '07731234501', lat: 36.3580, lng: 43.1550 },
  { name: 'صيدلية المجموعة الثقافية', governorate: 'نينوى', district: 'المجموعة الثقافية', addressDetails: 'مقابل جامعة الموصل - شارع الطلاب', phone: '07732345602', lat: 36.3750, lng: 43.1410 },
  { name: 'صيدلية الحدباء الحديثة', governorate: 'نينوى', district: 'حي الضباط', addressDetails: 'شارع المصلح - قرب مجمع الشفاء الطبي', phone: '07733456703', lat: 36.3420, lng: 43.1680 },
  { name: 'صيدلية السكر النموذجية', governorate: 'نينوى', district: 'حي السكر', addressDetails: 'شارع السوق - مجاور المستوصف', phone: '07734567804', lat: 36.3880, lng: 43.1720 },

  // السليمانية (3 صيدليات)
  { name: 'صيدلية السليمانية الدولية', governorate: 'السليمانية', district: 'سرشنار', addressDetails: 'شارع سالم - مجمع كوردستان الطبي', phone: '07741234501', lat: 35.5570, lng: 45.4350 },
  { name: 'صيدلية توي مليك', governorate: 'السليمانية', district: 'توي مليك', addressDetails: 'شارع الأطباء المركزي - عمارة الشفاء', phone: '07742345602', lat: 35.5680, lng: 45.4190 },
  { name: 'صيدلية بختياري السليمانية', governorate: 'السليمانية', district: 'بختياري', addressDetails: 'شارع مالك محمود الدائري - قرب فندق تايتنك', phone: '07743456703', lat: 35.5790, lng: 45.4020 },

  // بابل / الحلة (3 صيدليات)
  { name: 'صيدلية بابل التخصصية', governorate: 'بابل', district: 'الحلة المركزية', addressDetails: 'شارع 40 التجاري - مجمع النخيل الطبي', phone: '07831234501', lat: 32.4820, lng: 44.4210 },
  { name: 'صيدلية الجمعية النموذجية', governorate: 'بابل', district: 'حي الجمعية', addressDetails: 'شارع الكورنيش - مقابل العيادات الاستشارية', phone: '07832345602', lat: 32.4710, lng: 44.4350 },
  { name: 'صيدلية الإسكان الحلة', governorate: 'بابل', district: 'الإسكان', addressDetails: 'شارع مستشفى الحلة الجراحي - مجمع بابل', phone: '07833456703', lat: 32.4950, lng: 44.4100 },

  // كركوك (3 صيدليات)
  { name: 'صيدلية كركوك المركزية', governorate: 'كركوك', district: 'شارع القدس', addressDetails: 'شارع القدس التجاري - مجمع كركوك الطبي', phone: '07751234501', lat: 35.4680, lng: 44.3920 },
  { name: 'صيدلية رحيماوا الحديثة', governorate: 'كركوك', district: 'رحيماوا', addressDetails: 'الشارع العام - سوق رحيماوا', phone: '07752345602', lat: 35.4950, lng: 44.3810 },
  { name: 'صيدلية طريق بغداد', governorate: 'كركوك', district: 'طريق بغداد', addressDetails: 'قرب مجمع الأطباء الاستشاري - شارع المحاكم', phone: '07753456703', lat: 35.4510, lng: 44.3750 },

  // ديالى / بعقوبة (2 صيدليات)
  { name: 'صيدلية بعقوبة المركزية', governorate: 'ديالى', district: 'بعقوبة المركز', addressDetails: 'شارع الطابو - مجمع ديالى الطبي', phone: '07761234501', lat: 33.7480, lng: 44.6450 },
  { name: 'صيدلية التحرير النموذجية', governorate: 'ديالى', district: 'حي التحرير', addressDetails: 'شارع المستشفى العام - عمارة الشفاء', phone: '07762345602', lat: 33.7320, lng: 44.6580 },

  // ذي قار / الناصرية (2 صيدليات)
  { name: 'صيدلية أور التخصصية', governorate: 'ذي قار', district: 'الناصرية المركز', addressDetails: 'شارع الحبوبي - قرب ساحة الشهداء', phone: '07841234501', lat: 31.0450, lng: 46.2580 },
  { name: 'صيدلية الشيباني الحديثة', governorate: 'ذي قار', district: 'حي الإدارة المحلية', addressDetails: 'شارع المستشفى التركي - مجمع الحياة', phone: '07842345602', lat: 31.0580, lng: 46.2710 },

  // ميسان / العمارة (2 صيدليات)
  { name: 'صيدلية ميسان الكبرى', governorate: 'ميسان', district: 'العمارة المركز', addressDetails: 'شارع دجلة - مجمع العمارة الطبي', phone: '07851234501', lat: 31.8350, lng: 47.1450 },
  { name: 'صيدلية المعلمين النموذجية', governorate: 'ميسان', district: 'حي المعلمين', addressDetails: 'الشارع التجاري - قرب المستوصف', phone: '07852345602', lat: 31.8490, lng: 47.1620 },
];

async function main() {
  console.log('🚀 Starting Comprehensive Database Seeding...');
  console.log(`📦 Seeding ${MEDICINES_100.length} Medicines and ${PHARMACIES_60.length} Pharmacies Across Iraq...`);

  // 1. Seed or Upsert 100 Medicines in Master Catalog
  const createdMedicines: any[] = [];
  for (const med of MEDICINES_100) {
    const existing = await prisma.medicine.findFirst({
      where: { barcode: med.barcode },
    });

    let medicineRecord;
    if (existing) {
      medicineRecord = await prisma.medicine.update({
        where: { id: existing.id },
        data: {
          tradeName: med.tradeName,
          scientificName: med.scientificName,
          dosageForm: med.dosageForm,
          strength: med.strength,
          manufacturer: med.manufacturer,
          defaultUnitsPerPack: med.defaultUnitsPerPack,
        },
      });
    } else {
      medicineRecord = await prisma.medicine.create({
        data: {
          tradeName: med.tradeName,
          scientificName: med.scientificName,
          dosageForm: med.dosageForm,
          strength: med.strength,
          manufacturer: med.manufacturer,
          barcode: med.barcode,
          defaultUnitsPerPack: med.defaultUnitsPerPack,
          isVerified: true,
        },
      });
    }
    createdMedicines.push({ ...medicineRecord, defaultPrice: med.defaultPrice });
  }
  console.log(`✅ Successfully seeded/updated ${createdMedicines.length} Medicines in Master Catalog!`);

  // 2. Seed 60 Pharmacies (Tenants)
  const createdTenants: any[] = [];
  for (let i = 0; i < PHARMACIES_60.length; i++) {
    const p = PHARMACIES_60[i];
    const safeIndex = (i + 1).toString().padStart(2, '0');
    const slug = `pharmacy_iq_${safeIndex}`;
    const schemaName = `ph_iq_${safeIndex}`;
    const licenseKey = `DAWAEE-IQ-${safeIndex}-2026`;
    const googleMapsUrl = `https://maps.google.com/?q=${p.lat},${p.lng}`;

    let tenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 2);

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: p.name,
          slug,
          schemaName,
          governorate: p.governorate,
          district: p.district,
          addressDetails: p.addressDetails,
          googleMapsUrl,
          latitude: p.lat,
          longitude: p.lng,
          phone: p.phone,
          licenseKey,
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt,
        },
      });
    } else {
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          name: p.name,
          governorate: p.governorate,
          district: p.district,
          addressDetails: p.addressDetails,
          googleMapsUrl,
          latitude: p.lat,
          longitude: p.lng,
          phone: p.phone,
        },
      });
    }

    createdTenants.push(tenant);
  }
  console.log(`✅ Successfully seeded/updated ${createdTenants.length} Pharmacies!`);

  // Also include the primary demo pharmacy if it exists
  const defaultDemoTenant = await prisma.tenant.findUnique({
    where: { slug: 'pharmacy_yarmouk' },
  });
  if (defaultDemoTenant) {
    createdTenants.push(defaultDemoTenant);
  }

  // 3. Populate CentralSearchIndex for ALL Pharmacies x 100 Medicines
  console.log('🔄 Populating Central Search Index with all 100 medicines across all pharmacies...');
  let totalIndexed = 0;

  for (const tenant of createdTenants) {
    for (const med of createdMedicines) {
      // Slight realistic price variation (+/- 250 to 500 IQD rounded to 250)
      const priceVariation = (Math.floor(Math.random() * 3) - 1) * 250;
      const finalPrice = Math.max(250, med.defaultPrice + priceVariation);

      await prisma.centralSearchIndex.upsert({
        where: {
          tenantId_medicineId: {
            tenantId: tenant.id,
            medicineId: med.id,
          },
        },
        update: {
          pharmacyName: tenant.name,
          governorate: tenant.governorate,
          district: tenant.district,
          addressDetails: tenant.addressDetails,
          googleMapsUrl: tenant.googleMapsUrl,
          latitude: tenant.latitude,
          longitude: tenant.longitude,
          phone: tenant.phone,
          tradeName: med.tradeName,
          scientificName: med.scientificName,
          sellingPricePack: finalPrice,
          isAvailable: true,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId: tenant.id,
          medicineId: med.id,
          pharmacyName: tenant.name,
          governorate: tenant.governorate,
          district: tenant.district,
          addressDetails: tenant.addressDetails,
          googleMapsUrl: tenant.googleMapsUrl,
          latitude: tenant.latitude,
          longitude: tenant.longitude,
          phone: tenant.phone,
          tradeName: med.tradeName,
          scientificName: med.scientificName,
          sellingPricePack: finalPrice,
          isAvailable: true,
          lastSyncedAt: new Date(),
        },
      });

      totalIndexed++;
    }
  }

  console.log(`🎉 ALL DONE! Successfully populated ${totalIndexed} network search entries across ${createdTenants.length} pharmacies!`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

