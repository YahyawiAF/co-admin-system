import { PartialType } from '@nestjs/swagger';
import { AddStatusDto } from './create-status.dto';

export class UpdateStatusDto extends PartialType(AddStatusDto) {}
