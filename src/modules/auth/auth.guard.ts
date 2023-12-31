import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as AuthGuardPassport } from '@nestjs/passport';
import { UserRoles } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRequest } from 'src/interfaces/request';

@Injectable()
export class AuthGuard extends AuthGuardPassport('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super();
  }
  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.get<boolean>(
      'public',
      context.getHandler(),
    );
    if (isPublic) return true;

    const roles = this.reflector.get<UserRoles[]>(
      'roles',
      context.getHandler(),
    ) ?? ['ALL'];

    await super.canActivate(context);
    const request: AuthRequest = context.switchToHttp().getRequest();
    try {
      const user = request.user;
      if (!user) throw new UnauthorizedException();
      // if (!user.isVerified) {
      //   throw new ForbiddenException('Unauthorized please verify your email');
      // }
      if (user.role === 'ADMIN') return true;

      if (roles && !roles.includes(user.role))
        throw new UnauthorizedException('User Unauthorize');
      if (user.role === 'STUDENT') {
        const student = await this.prisma.student.findUnique({
          where: {
            userId: user.id,
          },
        });
        if (!student.isActivated) {
          throw new ForbiddenException('Unauthorized please activate account');
        }
      }
      return true;
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }

  handleRequest(err, user) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
