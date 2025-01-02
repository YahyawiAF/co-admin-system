import { PartialType } from '@nestjs/swagger';
import { AddMemberDto } from './createMember.dto';

export class UpdateMemberDto extends PartialType(AddMemberDto) {}
