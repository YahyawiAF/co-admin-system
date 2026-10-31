import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { AddAbonnementDto } from './createAbonnement.dto';

export class UpdateAbonnementDto extends PartialType(AddAbonnementDto) {
  /** Set by "Terminer maintenant"; cleared when the end date moves back to the future. */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @ApiProperty({ required: false, nullable: true })
  public terminatedAt?: Date | null;
}
