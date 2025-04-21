import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './createExp.dto';

export class UpdateExpDto extends PartialType(CreateExpenseDto) {}
