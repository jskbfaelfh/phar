import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateSubscriptionDto,
  UpdateStatusDto,
  ResetPasswordDto,
} from './dto/create-tenant.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('tenants')
  async createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto);
  }

  @Get('tenants')
  async getAllTenants(@Query() query: { status?: string; search?: string }) {
    return this.adminService.getAllTenants(query);
  }

  @Get('tenants/:id')
  async getTenantById(@Param('id') id: string) {
    return this.adminService.getTenantById(id);
  }

  @Get('tenants/:id/users')
  async getTenantUsers(@Param('id') id: string) {
    return this.adminService.getTenantUsers(id);
  }

  @Patch('tenants/:id/users/:userId/password')
  async resetTenantUserPassword(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.adminService.resetTenantUserPassword(id, userId, dto);
  }

  @Patch('tenants/:id')
  async updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.adminService.updateTenant(id, dto);
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id') id: string) {
    return this.adminService.deleteTenant(id);
  }

  @Patch('tenants/:id/subscription')
  async extendSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.adminService.extendSubscription(id, dto);
  }

  @Patch('tenants/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.adminService.updateTenantStatus(id, dto);
  }

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardMetrics();
  }
}
