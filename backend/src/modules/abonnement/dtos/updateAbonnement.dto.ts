import { PartialType } from '@nestjs/swagger';
import { AddAbonnementDto } from './createAbonnement.dto';

export class UpdateAbonnementDto extends PartialType(AddAbonnementDto) {}
