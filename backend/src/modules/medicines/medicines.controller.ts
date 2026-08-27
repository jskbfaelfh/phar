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

  @Post('seed')
  async seed() {
    return this.medicinesService.seedInitialMedicines();
  }
}
