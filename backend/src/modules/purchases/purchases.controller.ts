import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { PurchasesService } from './purchases.service';
import { OcrAiService } from './ocr-ai.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Controller('purchases')
@UseGuards(AuthGuard('jwt'), SubscriptionGuard)
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly ocrAiService: OcrAiService,
  ) {}

  @Post('ai-scan-invoice')
  aiScanInvoice(@Request() req: any, @Body() body: { imageBase64: string }) {
    return this.ocrAiService.processInvoiceImage(req.user.tenantId, body.imageBase64);
  }

  @Post()
  createPurchase(@Request() req: any, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.createPurchase(req.user.tenantId, dto);
  }

  @Get()
  getPurchases(@Request() req: any, @Query('search') search?: string) {
    return this.purchasesService.getPurchases(req.user.tenantId, search);
  }

  @Get('early-discount-alerts')
  getEarlyDiscountAlerts(@Request() req: any) {
    return this.purchasesService.getEarlyDiscountAlerts(req.user.tenantId);
  }

  @Post(':id/apply-early-discount')
  applyEarlyDiscount(@Request() req: any, @Param('id') id: string) {
    return this.purchasesService.applyEarlyDiscount(req.user.tenantId, id);
  }

  @Get(':id')
  getPurchaseById(@Request() req: any, @Param('id') id: string) {
    return this.purchasesService.getPurchaseById(req.user.tenantId, id);
  }
}
