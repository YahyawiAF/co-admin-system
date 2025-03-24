import {
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
  } from '@nestjs/common';
  import { PrismaService } from './../../../database/prisma.service';
  import { JwtService } from '@nestjs/jwt';
  import { AuthEntity } from './entity/auth.entity';
  import * as bcrypt from 'bcrypt';
  import { ConfigService } from '@nestjs/config';
  import { MailerService } from '@nestjs-modules/mailer';
  import { Role } from '@prisma/client'; // Assurez-vous d'importer Role depuis Prisma
  
  const roundsOfHashing = 10;
  
  @Injectable()
  export class AuthService {
    constructor(
      private prisma: PrismaService,
      private jwtService: JwtService,
      private configService: ConfigService,
      private mailerService: MailerService,
    ) {}
  
    /**
     * Inscription d'un nouvel utilisateur
     */
    async signUp(email: string, password: string, fullname: string): Promise<AuthEntity> {
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
          role: Role.USER, // Définir le rôle par défaut
        },
      });
  
      // Générer les tokens avec le rôle inclus
      const tokens = await this.getTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
  
      return {
        email: user.email,
        id: user.id,
        fullname: user.fullname,
        role: user.role,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
  
    /**
     * Connexion d'un utilisateur
     */
    async login(email: string, password: string): Promise<AuthEntity> {
      const user = await this.prisma.user.findUnique({ where: { email } });
  
      if (!user) {
        throw new NotFoundException(`No user found for email: ${email}`);
      }
  
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }
  
      // Générer les tokens avec le rôle inclus
      const tokens = await this.getTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
  
      // Stocker le accessToken dans la base de données
      await this.prisma.user.update({
        where: { id: user.id },
        data: { accessToken: tokens.accessToken },
      });
  
      return {
        email: user.email,
        role: user.role,
        id: user.id,
        fullname: user.fullname || '',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
  
    /**
     * Rafraîchir les tokens
     */
    async refreshTokens(userId: string, refreshToken: string): Promise<AuthEntity> {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
  
      if (!user || !user.refreshToken) {
        throw new ForbiddenException('Access Denied');
      }
  
      const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!refreshTokenMatches) throw new ForbiddenException('Access Denied');
  
      // Générer les nouveaux tokens avec le rôle inclus
      const tokens = await this.getTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
  
      return {
        fullname:user.fullname,
        email: user.email,
        role: user.role,
        id: user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
  
    /**
     * Déconnexion d'un utilisateur
     */
    async logout(userId: string): Promise<void> {
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { refreshToken: null, accessToken: null },
        });
      } catch (error) {
        console.error('Error during logout:', error);
        throw new InternalServerErrorException('Failed to logout');
      }
    }
  
    /**
     * Demande de réinitialisation de mot de passe
     */
    async requestPasswordReset(email: string): Promise<void> {
      const user = await this.prisma.user.findUnique({ where: { email } });
  
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }
  
      // Générer un token de réinitialisation avec l'ID et l'email de l'utilisateur
      const resetToken = this.jwtService.sign(
        { userId: user.id, email: user.email },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
          expiresIn: '1h',
        },
      );
  
      // Stocker le token dans la base de données
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetPasswordToken: resetToken },
      });
  
      // Envoyer un email avec le lien de réinitialisation
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
  
    /**
     * Réinitialisation du mot de passe
     */
    async resetPassword(token: string, newPassword: string): Promise<void> {
      try {
        // Vérifier le token
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        });
  
        if (!payload || !payload.email || !payload.userId) {
          throw new ForbiddenException('Jeton invalide');
        }
  
        // Récupérer l'utilisateur
        const user = await this.prisma.user.findUnique({
          where: { email: payload.email },
        });
  
        if (!user || user.resetPasswordToken !== token) {
          throw new ForbiddenException('Jeton invalide');
        }
  
        // Hasher le nouveau mot de passe
        const hashedPassword = await this.hashData(newPassword);
  
        // Mettre à jour le mot de passe et réinitialiser le token
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            resetPasswordToken: null, // Réinitialiser le token après utilisation
          },
        });
      } catch (error) {
        console.error('Erreur lors de la réinitialisation du mot de passe :', error.message);
        throw new ForbiddenException('Jeton invalide ou expiré');
      }
    }
  
    /**
     * Générer les tokens (accessToken et refreshToken)
     */
    private async getTokens(userId: string, email: string, role: Role) {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          this.jwtService.signAsync(
            {
              sub: userId,
              email,
              role, // Inclure le rôle dans le payload
            },
            {
              secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
              expiresIn: '15m',
            },
          ),
          this.jwtService.signAsync(
            {
              sub: userId,
              email,
              role, // Inclure le rôle dans le payload
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
      } catch (error) {
        console.error('Erreur lors de la génération des tokens:', error);
        throw new InternalServerErrorException('Failed to generate tokens');
      }
    }
  
    /**
     * Mettre à jour le refreshToken dans la base de données
     */
    private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
      const hashedRefreshToken = await this.hashData(refreshToken);
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: hashedRefreshToken },
      });
    }
  
    /**
     * Hasher une donnée (mot de passe, token, etc.)
     */
    private hashData(data: string): Promise<string> {
      return bcrypt.hash(data, roundsOfHashing);
    }
  }