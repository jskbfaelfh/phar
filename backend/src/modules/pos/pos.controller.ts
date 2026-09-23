import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PosService } from './pos.service';
import { CheckoutDto, CreateReturnDto, SyncOfflineSalesDto, CloseShiftDto, VerifyPasswordDto } from './dto/create-sale.dto';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';

@Controller('pos')
@UseGuards(AuthGuard('jwt'), SubscriptionGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('checkout')
  async checkout(@Body() dto: CheckoutDto) {
    return this.posService.checkout(dto);
  }

  @Post('sync-offline')
  async syncOfflineSales(@Body() dto: SyncOfflineSalesDto) {
    return this.posService.syncOfflineSales(dto);
  }

  @Post('return')
  async processReturnLegacy(@Body() dto: CreateReturnDto) {
    return this.posService.processReturn(dto);
  }

  @Post('returns')
  async processReturn(@Body() dto: CreateReturnDto) {
    return this.posService.processReturn(dto);
  }

  @Get('returns')
  async getRecentReturns(@Query('limit') limit?: number) {
    return this.posService.getRecentReturns(limit ? Number(limit) : 20);
  }

  @Get('daily-summary')
  async getDailySummary() {
    return this.posService.getDailySummary();
  }

  @Get('sales')
  async getSalesHistory(@Query() query: any) {
    return this.posService.getSalesHistory(query);
  }

  @Get('sales/:id')
  async getSaleById(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string) {
    return this.posService.getSaleById(id);
  }

  @Post('verify-password')
  async verifyPassword(@Request() req: any, @Body() dto: VerifyPasswordDto) {
    const userId = req.user?.id || req.user?.sub;
    const isMatch = await this.posService.verifyUserPassword(userId, dto.password);
    if (!isMatch) {
      throw new BadRequestException('كلمة المرور غير صحيحة');
    }
    return { success: true, verified: true, message: 'تم التحقق من كلمة المرور بنجاح' };
  }

  @Post('shifts/close')
  async closeShift(@Request() req: any, @Body() dto: CloseShiftDto) {
    return this.posService.closeShiftHandover(req.user, dto);
  }

  @Get('shifts/history')
  async getShiftHistory(@Query('limit') limit?: number) {
    return this.posService.getShiftHistory(limit ? Number(limit) : 30);
  }
}
