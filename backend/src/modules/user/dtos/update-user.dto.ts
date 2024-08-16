import { PartialType } from '@nestjs/swagger';
import { updateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(updateUserDto) {}
