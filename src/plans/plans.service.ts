import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PlansService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findDepositPlans(category: string, limit: number, skip: number) {
    const plans = await this.databaseService.deposit_plans.findMany({
      where: {
        category: category,
      },
      take: limit,
      skip: skip,
    });

    const total = await this.databaseService.deposit_plans.count({
      where: {
        category: category,
      },
    });

    return {
      status: true,
      message: {
        plans,
        total,
      },
    };
  }

  async findDepositPlanById(planid: number) {
    const plan = await this.databaseService.deposit_plans.findFirst({
      where: {
        id: planid,
      },
    });

    return {
      status: true,
      message: plan,
    };
  }

  async findLoanPlans(limit: number, skip: number) {
    const plans = await this.databaseService.loan_plans.findMany({
      take: limit,
      skip: skip,
    });

    const total = await this.databaseService.loan_plans.count();

    return {
      status: true,
      message: {
        plans,
        total,
      },
    };
  }

  async findLoanPlanById(planid: number) {
    const plan = await this.databaseService.loan_plans.findFirst({
      where: {
        id: planid,
      },
    });

    return {
      status: true,
      message: plan,
    };
  }

  async createLoanPlan(data: Prisma.loan_plansCreateInput) {
    await this.databaseService.loan_plans.create({
      data: {
        plan_name: data.plan_name,
        min_amount: Number(data.min_amount),
        max_amount: Number(data.max_amount),
        interest_rate: Number(data.interest_rate),
        premature_closing_charge: Number(data.premature_closing_charge),
        allow_premature_closing: data.allow_premature_closing,
        interest_frequency: data.interest_frequency,
        allowed_emi_frequency: data.allowed_emi_frequency,
        max_installments: Number(data.max_installments),
        processing_fee: Number(data.processing_fee),
        penalty_rate: Number(data.penalty_rate),
        commission_rate: Number(data.commission_rate),
        selling: data.selling,
      },
    });

    return {
      status: true,
      message: 'Plan has been created.',
    };
  }

  async createDepositPlan(
    category: string,
    data: Prisma.deposit_plansCreateInput,
  ) {
    await this.databaseService.deposit_plans.create({
      data: {
        category: category,
        plan_name: data.plan_name,
        min_amount: Number(data.min_amount),
        max_amount: Number(data.max_amount),
        interest_rate: Number(data.interest_rate),
        premature_withdrawal_charge: Number(data.premature_withdrawal_charge),
        allow_premature_withdrawal: data.allow_premature_withdrawal,
        allowed_interest_credit_frequency:
          data.allowed_interest_credit_frequency,
        allowed_payment_frequency: data.allowed_payment_frequency,
        penalty_rate: Number(data.penalty_rate),
        commission_rate: Number(data.commission_rate),
        selling: data.selling,
      },
    });

    return {
      status: true,
      message: 'Plan has been created.',
    };
  }

  async updateDepositPlan(planid: number, data) {
    await this.databaseService.deposit_plans.update({
      where: {
        id: planid,
      },
      data: {
        plan_name: data.plan_name,
        min_amount: Number(data.min_amount),
        max_amount: Number(data.max_amount),
        interest_rate: Number(data.interest_rate),
        premature_withdrawal_charge: Number(data.premature_withdrawal_charge),
        allow_premature_withdrawal: data.allow_premature_withdrawal,
        allowed_interest_credit_frequency:
          data.allowed_interest_credit_frequency,
        allowed_payment_frequency: data.allowed_payment_frequency,
        penalty_rate: Number(data.penalty_rate),
        commission_rate: Number(data.commission_rate),
        selling: data.selling,
      },
    });

    return {
      status: true,
      message: 'Plan has been Updated.',
    };
  }

  async updateLoanPlan(planid: number, data) {
    await this.databaseService.loan_plans.update({
      where: {
        id: planid,
      },
      data: {
        plan_name: data.plan_name,
        min_amount: Number(data.min_amount),
        max_amount: Number(data.max_amount),
        interest_rate: Number(data.interest_rate),
        premature_closing_charge: Number(data.premature_closing_charge),
        allow_premature_closing: data.allow_premature_closing,
        interest_frequency: data.interest_frequency,
        allowed_emi_frequency: data.allowed_emi_frequency,
        max_installments: Number(data.max_installments),
        processing_fee: Number(data.processing_fee),
        penalty_rate: Number(data.penalty_rate),
        commission_rate: Number(data.commission_rate),
        selling: data.selling,
      },
    });

    return {
      status: true,
      message: 'Plan has been Updated.',
    };
  }
}
