import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token =
      this.extractTokenFromHeader(request) ??
      this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      // console.log(payload);

      const user = await this.databaseService.user.findFirst({
        where: {
          id: payload.id,
        },
        select: {
          id: true,
          phone: true,
          email: true,
          name: true,
          image: true,
          role: true,
          ac_status: true,
          kyc_verified: true,
          permissions: true,
        },
      });

      request['user'] = { ...user };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractTokenFromCookie(req: Request): string | undefined {
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }
    return undefined;
  }
}
