import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    console.log("Authorization Header:", authHeader); // Vérification

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("No Bearer token found!");
      return false;
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = this.jwtService.verify(token);
      console.log("Decoded Token:", decoded); // Vérification
      request.user = decoded;
      return true;
    } catch (error) {
      console.log("Invalid Token:", error.message);
      return false;
    }
  }
}
