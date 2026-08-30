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
