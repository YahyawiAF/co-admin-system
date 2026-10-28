import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { LINK_PRESETS } from '../attribution';

const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/* ───────────── public ───────────── */

export class SurveyVisitDto {
  @Matches(KEY_RE)
  visitorKey: string;

  /** Tracked link code (?c=…) */
  @IsOptional() @IsString() @MaxLength(32) c?: string;
  @IsOptional() @IsString() @MaxLength(100) utm_source?: string;
  @IsOptional() @IsString() @MaxLength(100) utm_medium?: string;
  @IsOptional() @IsString() @MaxLength(100) utm_campaign?: string;
  @IsOptional() @IsString() @MaxLength(100) utm_content?: string;
  @IsOptional() @IsString() @MaxLength(100) utm_term?: string;

  /** First open of this link in this browser session (counts one click) */
  @IsOptional() @IsBoolean() firstOpen?: boolean;
}

export class SurveyStartDto {
  @Matches(KEY_RE)
  visitorKey: string;
}

export class SurveyContactDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsBoolean() consent?: boolean;
}

export class SubmitSurveyDto extends SurveyVisitDto {
  /** One per submit attempt, kept by the browser until success: retries return the same response */
  @Matches(KEY_RE)
  idempotencyKey: string;

  @IsObject()
  answers: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  @Type(() => SurveyContactDto)
  contact?: SurveyContactDto;

  /** Visitor already known by the app on this phone */
  @IsOptional() @IsUUID() memberId?: string;

  /** Honeypot: hidden field, people leave it empty */
  @IsOptional() @IsString() @MaxLength(200) hp?: string;

  /** Time spent on the form (ms) */
  @IsOptional() @IsInt() @Min(0) elapsedMs?: number;
}

/* ───────────── admin ───────────── */

export class CreateSurveyDto {
  /** Built-in template code (e.g. learn_share) */
  @IsOptional() @IsString() @MaxLength(40) templateCode?: string;
  /** Copy an existing survey */
  @IsOptional() @IsUUID() duplicateOf?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
}

export class UpdateSurveyDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) title?: string;
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Adresse : lettres minuscules, chiffres et tirets',
  })
  @MaxLength(60)
  slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) intro?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) purpose?: string;
  @IsOptional() @IsString() @MaxLength(300) audience?: string;
  @ValidateIf((_, v) => v !== null) @IsOptional() @IsDateString() closesAt?:
    | string
    | null;
  @IsOptional() @IsArray() questions?: unknown[];
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}

export class SurveyStatusDto {
  @IsIn(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'])
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED';
}

export class CreateSurveyLinkDto {
  @IsIn(Object.keys(LINK_PRESETS))
  preset: keyof typeof LINK_PRESETS;
  /** "Club IEEE ENIT", "Affiche bibliothèque"… */
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsString() @MaxLength(80) campaign?: string;
  @IsOptional() @IsString() @MaxLength(80) content?: string;
}

export class SurveyFiltersDto {
  @IsOptional() @IsUUID() linkId?: string;
  @IsOptional() @IsString() @MaxLength(40) source?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['MEMBER', 'NEW_MEMBER', 'KNOWN', 'ANONYMOUS']) type?:
    | 'MEMBER'
    | 'NEW_MEMBER'
    | 'KNOWN'
    | 'ANONYMOUS';
  @IsOptional() @IsIn(['LEARN', 'SHARE', 'BOTH']) role?:
    | 'LEARN'
    | 'SHARE'
    | 'BOTH';
  /** Include spam-flagged and replaced answers */
  @IsOptional() @IsIn(['0', '1']) all?: '0' | '1';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class LinkMemberDto {
  @IsUUID()
  memberId: string;
}

export class CreateLearningSessionDto {
  @IsString() @IsNotEmpty() @MaxLength(120) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(80) subject?: string;
  @IsDateString() startAt: string;
  @IsDateString() endAt: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) capacity?: number;
  /** Volunteer's survey answer */
  @IsOptional() @IsUUID() hostResponseId?: string;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED']) status?: 'DRAFT' | 'PUBLISHED';
}

export class SessionRewardDto {
  @IsBoolean() given: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class SurveyIdQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
