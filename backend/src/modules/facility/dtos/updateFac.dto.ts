import { PartialType } from '@nestjs/swagger';
import { CreateFacilityDto } from './createfac.dto';

export class UpdateFacilityDto extends PartialType(CreateFacilityDto) {}
