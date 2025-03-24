//src/auth/auth.service.ts
import {
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
  } from '@nestjs/common';
  import { PrismaService } from './../../../database/prisma.service';
  import { JwtService } from '@nestjs/jwt';
  import { AuthEntity } from './entity/auth.entity';
  import * as bcrypt from 'bcrypt';
  import { ConfigService } from '@nestjs/config';
  import { MailerService } from '@nestjs-modules/mailer';
  
  const roundsOfHashing = 10;
  
  @Injectable()
  export class AuthService {
    constructor(
      private prisma: PrismaService,
      private jwtService: JwtService,
      private configService: ConfigService,
      private mailerService: MailerService,
    ) {}
    async signUp(email: string, password: string, fullname: string) {
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
    
      if (existingUser) {
        throw new ForbiddenException('Email already in use');
      }
    
      const hashedPassword = await this.hashData(password);
    
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          fullname,
        },
      });
    
      const tokens = await this.getTokens(user.id, user.email);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
    
      return {
        email: user.email,
        id: user.id,
        fullname: user.fullname,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
    
  
    async login(email: string, password: string): Promise<AuthEntity> {
      const user = await this.prisma.user.findUnique({ where: { email: email } });
    
      if (!user) {
        throw new NotFoundException(`No user found for email: ${email}`);
      }
    
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }
    
      const tokens = await this.getTokens(user.id, user.email);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
    
      return {
        email,
        role: user.role,
        id: user.id,
        fullname: user.fullname || '',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
    
    
    async refreshTokens(userId: string, refreshToken: string) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
  
      if (!user || !user.refreshToken) {
        throw new ForbiddenException('Access Denied');
      }
      const refreshTokenMatches = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );
      if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');
      const tokens = await this.getTokens(user.id, user.email);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
      return {
        email: user.email,
        role: user.role,
        id: user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
  
    async updateRefreshToken(userId: string, refreshToken: string) {
      const hashedRefreshToken = await this.hashData(refreshToken);
      await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          refreshToken: hashedRefreshToken,
        },
      });
    }
  
    async logout(userId: string) {
      return this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          refreshToken: null,
        },
      });
    }
  
    private async getTokens(userId: string, username: string) {
      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(
          {
            userId: userId,
            username,
          },
          {
            secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
            expiresIn: '1m',
          },
        ),
        this.jwtService.signAsync(
          {
            sub: userId,
            username,
          },
          {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
          },
        ),
      ]);
  
      return {
        accessToken,
        refreshToken,
      };
    }
    private hashData(data: string) {
      return bcrypt.hash(data, roundsOfHashing);
    }
    async requestPasswordReset(email: string): Promise<void> {
        const user = await this.prisma.user.findUnique({ where: { email } });
      
        if (!user) {
          throw new NotFoundException('Utilisateur non trouvé');
        }
      
        // Ajoutez userId au payload du jeton
        const resetToken = this.jwtService.sign(
          { userId: user.id, email: user.email }, // Incluez userId et email
          {
            secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
            expiresIn: '1h',
          },
        );
      
        await this.prisma.user.update({
          where: { id: user.id },
          data: { resetPasswordToken: resetToken },
        });
      
        const resetUrl = `http://localhost:3000/auth/reset-password?token=${resetToken}`;
      
        await this.mailerService.sendMail({
          to: email,
          subject: 'Demande de réinitialisation de mot de passe',
          template: 'password-reset',
          context: {
            name: user.fullname,
            resetUrl,
          },
        });
      }
     async resetPassword(token: string, newPassword: string): Promise<void> {
  try {
    console.log('Jeton reçu :', token);

    // Vérifiez le jeton
    const payload = this.jwtService.verify(token, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
    });

    console.log('Payload du jeton :', payload);

    if (!payload || !payload.email || !payload.userId) {
      throw new ForbiddenException('Jeton invalide');
    }

    // Récupérez l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      console.log('Utilisateur non trouvé pour l\'email :', payload.email);
      throw new ForbiddenException('Jeton invalide');
    }

    // Vérifiez que le jeton stocké correspond au jeton reçu
    if (user.resetPasswordToken !== token) {
      console.log('Incompatibilité de jeton :', user.resetPasswordToken, '!=', token);
      throw new ForbiddenException('Jeton invalide');
    }

    // Hash du nouveau mot de passe
    const hashedPassword = await this.hashData(newPassword);

    // Mettez à jour le mot de passe et réinitialisez le jeton
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null, // Réinitialisez le jeton après utilisation
      },
    });

    console.log('Mot de passe réinitialisé avec succès pour l\'utilisateur :', user.email);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', error.message);
    throw new ForbiddenException('Jeton invalide ou expiré');
  }
}
      }
  