import { PartialType } from '@nestjs/swagger';
import { AddJournalDto } from './createJournal.dto';

export class UpdateJournalDto extends PartialType(AddJournalDto) {}
