import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VaultService } from './vault.service';

@Controller('vault')
@UseGuards(AuthGuard('jwt'), SubscriptionGuard, RolesGuard)
@Roles('OWNER', 'SUPER_ADMIN')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Get('pin-status')
  checkPinStatus(@Request() req: any) {
    return this.vaultService.checkPinStatus(req.user.tenantId);
  }

  @Post('verify-pin')
  verifyPin(@Request() req: any, @Body() body: { pin: string }) {
    return this.vaultService.verifyPin(req.user.tenantId, body.pin);
  }

  @Post('setup-pin')
  setupPin(@Request() req: any, @Body() body: { newPin: string; oldPin?: string }) {
    return this.vaultService.setupOrChangePin(req.user.tenantId, body.newPin, body.oldPin);
  }

  @Get('items')
  getItems(@Request() req: any, @Query('search') search?: string) {
    return this.vaultService.getItems(req.user.tenantId, search);
  }

  @Post('items')
  saveItem(@Request() req: any, @Body() body: any) {
    return this.vaultService.saveItem(req.user.tenantId, body);
  }

  @Delete('items/:id')
  deleteItem(@Request() req: any, @Param('id') id: string) {
    return this.vaultService.deleteItem(req.user.tenantId, id);
  }

  @Post('stock-in')
  stockIn(
    @Request() req: any,
    @Body() body: { itemId: string; quantity: number; unitPrice: number; source?: string; notes?: string },
  ) {
    return this.vaultService.recordStockIn(req.user.tenantId, body);
  }

  @Post('stock-out')
  stockOut(
    @Request() req: any,
    @Body() body: { itemId: string; quantity: number; reason?: string; notes?: string },
  ) {
    return this.vaultService.recordStockOut(req.user.tenantId, body);
  }

  @Post('sale')
  recordSale(
    @Request() req: any,
    @Body()
    body: {
      items: Array<{ itemId: string; quantity: number; unitPrice: number }>;
      customerName?: string;
      notes?: string;
    },
  ) {
    return this.vaultService.recordSale(req.user.tenantId, body);
  }

  @Get('transactions')
  getTransactions(@Request() req: any, @Query('type') type?: string, @Query('limit') limit?: string) {
    return this.vaultService.getTransactions(req.user.tenantId, type, limit ? Number(limit) : 100);
  }

  @Get('summary')
  getSummary(@Request() req: any) {
    return this.vaultService.getSummary(req.user.tenantId);
  }
}
