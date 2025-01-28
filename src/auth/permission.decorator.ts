import { SetMetadata } from "@nestjs/common";
import { TPermissions } from "./permission.guard";

export const RequiredPermissions = (...permissions: TPermissions[]) =>
  SetMetadata("permissions", permissions);
