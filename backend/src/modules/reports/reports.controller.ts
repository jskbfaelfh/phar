import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { DateRangeDto } from './dto/date-range.dto';
import { SubscriptionGuard } from '../../common/guards/subscription.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), SubscriptionGuard, RolesGuard)
@Roles('OWNER')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('financial')
  async getFinancialReport(@Query() query: DateRangeDto) {
    return this.reportsService.getFinancialReport(query);
  }

  @Get('top-selling')
  async getTopSellingMedicines(@Query() query: DateRangeDto) {
    return this.reportsService.getTopSellingMedicines(query);
  }

  @Get('inventory-valuation')
  async getInventoryValuation() {
    return this.reportsService.getInventoryValuation();
  }

  @Get('stocktake/current')
  async getDetailedCurrentStocktake() {
    return this.reportsService.getDetailedCurrentStocktake();
  }

  @Get('stocktake/sold')
  async getSoldMedicinesStocktake(@Query() query: DateRangeDto) {
    return this.reportsService.getSoldMedicinesStocktake(query);
  }

  @Get('debts/summary')
  async getDebtsReport(@Query() query: DateRangeDto) {
    return this.reportsService.getDebtsReport(query);
  }
}
