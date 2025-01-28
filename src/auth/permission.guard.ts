import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { user } from "@prisma/client";

export const PERMISSIONS = {
  "User Management": "user_management",
  "KYC Management": "kyc_management",
  "Loan Approval": "loan_approval",
  "Loan Settlement": "loan_settlement",
  "Deposit Approval": "deposit_approval",
  "Deposit Maturity": "deposit_maturity",
  "Repayment Collection": "repayment_collection",
  "Repayment Correction": "repayment_correction",
  "Withdrawal Management": "withdrawal_management",
  "Agent Collection": "agent_collection",
  "Agent Assignment": "agent_assignment",
  "View User Details": "view_user_details",
} as const;

export type TPermissions = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request["user"] as user;

    // Retrieve permissions from metadata
    const requiredPermissions: TPermissions[] =
      this.reflector.get<TPermissions[]>("permissions", context.getHandler()) ||
      [];

    try {
      if (!this.withPermission(user, requiredPermissions)) {
        throw new UnauthorizedException();
      }
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private withPermission(user: user, permissions: TPermissions[]): boolean {
    if (user.role === "Admin") return true;

    if (!user.permissions) return false;

    const user_permissions = JSON.parse(user.permissions);

    // Check if the user has at least one of the required permissions
    return permissions.every((permission) =>
      user_permissions.includes(permission)
    );
  }
}
