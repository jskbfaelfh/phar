import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Controller('purchases')
@UseGuards(AuthGuard('jwt'), SubscriptionGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  createPurchase(@Request() req: any, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.createPurchase(req.user.tenantId, dto);
  }

  @Get()
  getPurchases(@Request() req: any, @Query('search') search?: string) {
    return this.purchasesService.getPurchases(req.user.tenantId, search);
  }

  @Get(':id')
  getPurchaseById(@Request() req: any, @Param('id') id: string) {
    return this.purchasesService.getPurchaseById(req.user.tenantId, id);
  }
}
