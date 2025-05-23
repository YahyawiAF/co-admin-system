import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: { userId: string }) {
    const user = await this.usersService.findOne(payload.userId);
  
    if (!user) {
      throw new UnauthorizedException();
    }
  
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullname: user.fullname, // optionnel
    };
  }
  
}
