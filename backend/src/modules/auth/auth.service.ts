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
import { Role } from '@prisma/client';
import { isEmail } from 'class-validator';
import * as twilio from 'twilio';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const roundsOfHashing = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly twilioClient: twilio.Twilio;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {
    this.twilioClient = twilio(
      this.configService.get<string>('TWILIO_ACCOUNT_SID'),
      this.configService.get<string>('TWILIO_AUTH_TOKEN'),
    );
  }

  async signUp(
    identifier: string,
    password: string,
    fullname: string,
    role: Role,
  ): Promise<AuthEntity> {
    // Validate identifier format
    let cleanIdentifier: string;
    let isIdentifierEmail = isEmail(identifier);

    if (isIdentifierEmail) {
      cleanIdentifier = identifier.toLowerCase().trim();
    } else {
      // Validate and format phone number
      if (!isValidPhoneNumber(identifier)) {
        throw new BadRequestException('Please enter a valid phone number');
      }
      const phoneNumber = parsePhoneNumber(identifier);
      if (!phoneNumber || !phoneNumber.isValid()) {
        throw new BadRequestException('Invalid phone number format');
      }
      cleanIdentifier = phoneNumber.format('E.164'); // e.g., +1234567890
    }

    // Check password strength
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Check if identifier already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: isIdentifierEmail ? cleanIdentifier : undefined },
          { phoneNumber: !isIdentifierEmail ? cleanIdentifier : undefined },
        ],
      },
    });

    if (existingUser) {
      if (isIdentifierEmail) {
        throw new ForbiddenException('This email address is already registered');
      } else {
        throw new ForbiddenException('This phone number is already registered');
      }
    }

    // For non-ADMIN users, check if a Member exists with the phone number
    let memberId: string | undefined;
    if (role === Role.USER && !isIdentifierEmail) {
      const existingMember = await this.prisma.member.findUnique({
        where: { phone: cleanIdentifier },
      });
      if (existingMember) {
        throw new ForbiddenException('A member with this phone number already exists');
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

      // Create Member for non-ADMIN users signing up with phone number
      if (role === Role.USER && !isIdentifierEmail) {
        const names = fullname.trim().split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';
        const member = await this.prisma.member.create({
          data: {
            phone: cleanIdentifier,
            firstName,
            lastName,
            email: null,
            userId: user.id,
            isActive: true,
          },
        });
        memberId = member.id;
      }

      const tokens = await this.getTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        ...tokens,
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullname: user.fullname,
        role: user.role,
        memberId,
      };
    } catch (error) {
      this.logger.error(`Signup failed: ${error.message}`);
      throw new InternalServerErrorException('Registration failed. Please try again later.');
    }
  }

  async login(identifier: string, password: string): Promise<AuthEntity> {
    // Validate identifier format
    let cleanIdentifier: string;
    let isIdentifierEmail = isEmail(identifier);

    if (isIdentifierEmail) {
      cleanIdentifier = identifier.toLowerCase().trim();
    } else {
      if (!isValidPhoneNumber(identifier)) {
        throw new BadRequestException('Please enter a valid phone number');
      }
      const phoneNumber = parsePhoneNumber(identifier);
      if (!phoneNumber || !phoneNumber.isValid()) {
        throw new BadRequestException('Invalid phone number format');
      }
      cleanIdentifier = phoneNumber.format('E.164');
    }

    // Find user by email or phoneNumber
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: isIdentifierEmail ? cleanIdentifier : undefined },
          { phoneNumber: !isIdentifierEmail ? cleanIdentifier : undefined },
        ],
      },
      include: { member: true },
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
        memberId: user.member?.id,
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw new InternalServerErrorException('Login failed. Please try again later.');
    }
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: true },
    });

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
      phoneNumber: user.phoneNumber,
      role: user.role,
      memberId: user.member?.id,
    };
  }

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

 async requestPasswordReset(identifier: string): Promise<void> {
  // Validate identifier format
  let cleanIdentifier: string;
  const isIdentifierEmail = isEmail(identifier);

  if (isIdentifierEmail) {
    cleanIdentifier = identifier.toLowerCase().trim();
  } else {
    if (!isValidPhoneNumber(identifier)) {
      throw new BadRequestException('Please enter a valid phone number');
    }
    const phoneNumber = parsePhoneNumber(identifier);
    if (!phoneNumber || !phoneNumber.isValid()) {
      throw new BadRequestException('Invalid phone number format');
    }
    cleanIdentifier = phoneNumber.format('E.164');
  }

  const user = await this.prisma.user.findFirst({
    where: {
      OR: [
        { email: isIdentifierEmail ? cleanIdentifier : undefined },
        { phoneNumber: !isIdentifierEmail ? cleanIdentifier : undefined },
      ],
    },
  });

  if (!user) {
    throw new NotFoundException(
      isIdentifierEmail
        ? 'Utilisateur non trouvé avec cet email'
        : 'Utilisateur non trouvé avec ce numéro de téléphone',
    );
  }

  if (isIdentifierEmail) {
    // Handle email-based password reset
    const resetToken = this.jwtService.sign(
      { userId: user.id, email: user.email },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '3h',
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: resetToken },
    });

    const baseUrl =
      user.role === 'USER'
        ? 'http://localhost:3000/client/reset-password'
        : 'http://localhost:3000/auth/reset-password';

    const resetUrl = `${baseUrl}?token=${resetToken}&role=${user.role.toLowerCase()}`;

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Demande de réinitialisation de mot de passe',
        template: 'password-reset',
        context: {
          name: user.fullname || 'Utilisateur',
          resetUrl,
        },
      });
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${user.email}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Échec de l\'envoi de l\'email. Veuillez vérifier la configuration SMTP.');
    }
  } else {
    // Handle phone-based password reset
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordCode: resetCode,
        resetPasswordCodeExpires: expiresAt,
      },
    });

    try {
      await this.twilioClient.messages.create({
        body: `Votre code de réinitialisation de mot de passe est : ${resetCode}. Il expire dans 15 minutes.`,
        from: this.configService.get<string>('TWILIO_PHONE_NUMBER'),
        to: cleanIdentifier,
      });
      this.logger.log(`SMS sent to ${cleanIdentifier} with reset code`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${cleanIdentifier}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Échec de l\'envoi du SMS. Veuillez vérifier le numéro de téléphone et réessayer.');
    }
  }
}

  async verifyResetCode(phoneNumber: string, code: string): Promise<void> {
    if (!isValidPhoneNumber(phoneNumber)) {
      throw new BadRequestException('Veuillez entrer un numéro de téléphone valide');
    }

    const cleanPhoneNumber = parsePhoneNumber(phoneNumber).format('E.164');

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: cleanPhoneNumber },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé avec ce numéro de téléphone');
    }

    if (!user.resetPasswordCode || !user.resetPasswordCodeExpires) {
      throw new ForbiddenException('Aucun code de réinitialisation trouvé');
    }

    if (user.resetPasswordCode !== code) {
      throw new ForbiddenException('Code de réinitialisation invalide');
    }

    if (new Date() > user.resetPasswordCodeExpires) {
      throw new ForbiddenException('Code de réinitialisation expiré');
    }

    // Code is valid; clear the code and expiration
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordCode: null,
        resetPasswordCodeExpires: null,
      },
    });
  }

  async resetPasswordWithPhone(phoneNumber: string, newPassword: string): Promise<void> {
    if (!isValidPhoneNumber(phoneNumber)) {
      throw new BadRequestException('Veuillez entrer un numéro de téléphone valide');
    }

    const cleanPhoneNumber = parsePhoneNumber(phoneNumber).format('E.164');

    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: cleanPhoneNumber },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé avec ce numéro de téléphone');
    }

    const hashedPassword = await this.hashData(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordCode: null,
        resetPasswordCodeExpires: null,
      },
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      if (!payload || !payload.email || !payload.userId) {
        throw new ForbiddenException('Jeton invalide');
      }

      const user = await this.prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (!user || user.resetPasswordToken !== token) {
        throw new ForbiddenException('Jeton invalide');
      }

      const hashedPassword = await this.hashData(newPassword);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
        },
      });
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe :', error.message);
      throw new ForbiddenException('Jeton invalide ou expiré');
    }
  }

  async getTokens(userId: string, email: string, role: string) {
    const payload = {
      userId,
      email,
      role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await this.hashData(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }

  private hashData(data: string): Promise<string> {
    return bcrypt.hash(data, roundsOfHashing);
  }
}
