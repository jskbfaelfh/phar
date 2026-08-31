import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto, QueryMedicineDto } from './dto/create-medicine.dto';

@Controller('medicines')
@UseGuards(AuthGuard('jwt'))
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get('unverified')
  async getUnverified(@Query('search') search?: string) {
    return this.medicinesService.getUnverified(search);
  }

  @Get('search')
  async search(@Query() query: QueryMedicineDto) {
    return this.medicinesService.search(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.medicinesService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateMedicineDto) {
    return this.medicinesService.create(dto);
  }

  @Post(':id/verify')
  async verifyMedicine(
    @Param('id') id: string,
    @Body() body?: Partial<CreateMedicineDto>,
  ) {
    return this.medicinesService.verifyMedicine(id, body);
  }

  @Post('delete-medicine/:id')
  async deleteMedicine(@Param('id') id: string) {
    return this.medicinesService.deleteMedicine(id);
  }

  @Post('ai-smart-search')
  async aiSmartSearch(
    @Body() body: { query: string; inStockOnly?: boolean },
    @Param() _params: any,
    @Query() _query: any,
    @Body() _body: any,
  ) {
    // Note: Request user context is extracted via MedicinesService using TenantContext or Prisma
    return this.medicinesService.aiSmartSearch(body.query, body.inStockOnly);
  }

  @Post('seed')
  async seed() {
    return this.medicinesService.seedInitialMedicines();
  }
}
