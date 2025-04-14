import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
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
import { isEmail, isMobilePhone } from 'class-validator';
  
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
    async signUp(
        identifier: string,
        password: string,
        fullname: string,
        role: Role
      ): Promise<AuthEntity> {
        // Validate identifier format
        if (!isEmail(identifier) && !isMobilePhone(identifier)) {
          throw new BadRequestException('Please enter a valid email address or phone number');
        }
      
        // Clean the identifier
        const isIdentifierEmail = isEmail(identifier);
        const cleanIdentifier = isIdentifierEmail
          ? identifier.toLowerCase().trim()
          : identifier.replace(/\s+/g, '');
      
        // Check password strength (optional)
        if (password.length < 8) {
          throw new BadRequestException('Password must be at least 8 characters long');
        }
      
        // Check if identifier already exists
        const existingUser = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: isIdentifierEmail ? cleanIdentifier : undefined },
              { phoneNumber: !isIdentifierEmail ? cleanIdentifier : undefined }
            ]
          }
        });
      
        if (existingUser) {
          if (isIdentifierEmail) {
            throw new ForbiddenException('This email address is already registered');
          } else {
            throw new ForbiddenException('This phone number is already registered');
          }
        }
      
        try {
          const hashedPassword = await this.hashData(password);
          const user = await this.prisma.user.create({
            data: {
              email: isIdentifierEmail ? cleanIdentifier : null,
              phoneNumber: !isIdentifierEmail ? cleanIdentifier : null,
              password: hashedPassword,
              fullname: fullname.trim(),
              role,
            },
          });
      
          const tokens = await this.getTokens(user.id, user.email, user.role);
          await this.updateRefreshToken(user.id, tokens.refreshToken);
      
          return {
            ...tokens,
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            fullname: user.fullname,
            role: user.role,
          };
        } catch (error) {
          this.logger.error(`Signup failed: ${error.message}`);
          throw new InternalServerErrorException('Registration failed. Please try again later.');
        }
      }
      private readonly logger = new Logger(AuthService.name);
    

    /**
     * Connexion d'un utilisateur
     */
    async login(identifier: string, password: string): Promise<AuthEntity> {
        // First validate the identifier format
        if (!isEmail(identifier) && !isMobilePhone(identifier)) {
          throw new BadRequestException('Please enter a valid email address or phone number');
        }
        
      
        // Clean the identifier
        const isIdentifierEmail = isEmail(identifier);
        const cleanIdentifier = isIdentifierEmail
          ? identifier.toLowerCase().trim()
          : identifier.replace(/\s+/g, '');
      
        // Find user by email or phoneNumber
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: isIdentifierEmail ? cleanIdentifier : undefined },
              { phoneNumber: !isIdentifierEmail ? cleanIdentifier : undefined }
            ]
          }
        });
      
        if (!user) {
          if (isIdentifierEmail) {
            throw new NotFoundException('No account found with this email address');
          } else {
            throw new NotFoundException('No account found with this phone number');
          }
        }
      
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          throw new UnauthorizedException('The password you entered is incorrect');
        }
      
        try {
          const tokens = await this.getTokens(user.id, user.email, user.role);
          await this.updateRefreshToken(user.id, tokens.refreshToken);
      
          await this.prisma.user.update({
            where: { id: user.id },
            data: { accessToken: tokens.accessToken },
          });
      
          return {
            ...tokens,
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            phoneNumber: user.phoneNumber,
            role: user.role,
          };
        } catch (error) {
          this.logger.error(`Login failed: ${error.message}`);
          throw new InternalServerErrorException('Login failed. Please try again later.');
        }
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
      
        const tokens = await this.getTokens(user.id, user.email, user.role);
        await this.updateRefreshToken(user.id, tokens.refreshToken);
      
        return {
          ...tokens,
          id: user.id,
          email: user.email,
          fullname: user.fullname,
          phoneNumber: user.phoneNumber, // Ajouté
          role: user.role,
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
          expiresIn: '3h',
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
    async getTokens(userId: string, email: string, role: string) {
        const payload = {
          userId, // ✅ ce champ est utilisé par JwtStrategy
          email,
          role,   // optionnel, si tu veux faire du role-based access
        };
      
        const accessToken = await this.jwtService.signAsync(payload, {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: '15m',
        });
      
        const refreshToken = await this.jwtService.signAsync(payload, {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '7d',
        });
      
        return {
          accessToken,
          refreshToken,
        };
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