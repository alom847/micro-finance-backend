import {
  Controller,
  Get,
  Body,
  Post,
  Req,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { DatabaseService } from '../database/database.service';
import { PlansService } from './plans.service';

@UseGuards(AuthGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post('loan')
  async createLoanPlan(@Req() req, @Body() body) {
    if (!['Admin'].includes(req.user.role))
      throw new BadRequestException(
        'You are not authorized to create new plan',
      );

    return this.plansService.createLoanPlan(body);
  }

  @Post('deposit')
  async createDepositPlan(@Req() req, @Body() body) {
    if (!['Admin'].includes(req.user.role))
      throw new BadRequestException(
        'You are not authorized to create new plan',
      );

    return this.plansService.createDepositPlan(body.category, body.data);
  }

  @Get('deposit')
  async fetchDepositPlans(
    @Req() req,
    @Query('category') category,
    @Query('limit') limit: string | undefined,
    @Query('skip') skip: string | undefined,
  ) {
    return this.plansService.findDepositPlans(
      category,
      parseInt(limit ?? '10'),
      parseInt(skip ?? '0'),
    );
  }

  @Get('loan')
  async fetchLoanPlans(
    @Req() req,
    @Query('limit') limit: string | undefined,
    @Query('skip') skip: string | undefined,
  ) {
    return this.plansService.findLoanPlans(
      parseInt(limit ?? '10'),
      parseInt(skip ?? '0'),
    );
  }

  @Get('loan/:id')
  async fetchLoanPlanById(@Req() req, @Param('id', ParseIntPipe) id) {
    return this.plansService.findLoanPlanById(id);
  }

  @Post('loan/:id')
  async UpdateLoanPlanById(
    @Req() req,
    @Param('id', ParseIntPipe) id,
    @Body() body,
  ) {
    if (!['Admin'].includes(req.user.role))
      throw new BadRequestException(
        'You are not authorized to create new plan',
      );

    return this.plansService.updateLoanPlan(id, body);
  }

  @Get('deposit/:id')
  async fetchDepositPlanById(@Req() req, @Param('id', ParseIntPipe) id) {
    return this.plansService.findDepositPlanById(id);
  }

  @Post('deposit/:id')
  async UpdateDepositPlanById(
    @Req() req,
    @Param('id', ParseIntPipe) id,
    @Body() body,
  ) {
    if (!['Admin'].includes(req.user.role))
      throw new BadRequestException(
        'You are not authorized to create new plan',
      );

    return this.plansService.updateDepositPlan(id, body);
  }
}
