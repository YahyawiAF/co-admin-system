import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Role, SurveyStatus } from '@prisma/client';
import { JwtAuthGuard } from 'common/guards/accessToken.guard';
import type { Actor } from '../staff/staff.service';
import { SurveysAdminService } from './surveys-admin.service';
import { SurveysPublicService } from './surveys-public.service';
import {
  CreateLearningSessionDto,
  CreateSurveyDto,
  CreateSurveyLinkDto,
  LinkMemberDto,
  SessionRewardDto,
  SubmitSurveyDto,
  SurveyFiltersDto,
  SurveyStartDto,
  SurveyStatusDto,
  SurveyVisitDto,
  UpdateSurveyDto,
} from './dtos/survey.dto';

type AuthedRequest = Request & {
  user?: { userId?: string; sub?: string; role?: Role };
};

function actorOf(req: AuthedRequest): Actor {
  return {
    userId: (req.user?.userId || req.user?.sub) as string,
    role: req.user?.role as Role,
  };
}

function orgHint(req: Request): string | null {
  const q = req.query?.organizationId;
  const h = req.headers['x-organization-id'];
  return (typeof q === 'string' && q) || (typeof h === 'string' && h) || null;
}

/** Learn & Share admin: org admins only (staff accounts are refused by assertOrgAdmin). */
@Controller('admin/surveys')
@ApiTags('surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class SurveysAdminController {
  constructor(private readonly surveys: SurveysAdminService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.surveys.list(actorOf(req), orgHint(req));
  }

  @Get('templates')
  templates() {
    return this.surveys.templates();
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateSurveyDto) {
    return this.surveys.create(actorOf(req), orgHint(req), dto);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.surveys.get(actorOf(req), id);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSurveyDto,
  ) {
    return this.surveys.update(actorOf(req), id, dto);
  }

  @Patch(':id/status')
  status(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SurveyStatusDto,
  ) {
    return this.surveys.setStatus(actorOf(req), id, dto.status as SurveyStatus);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.surveys.remove(actorOf(req), id);
  }

  @Post(':id/links')
  createLink(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSurveyLinkDto,
  ) {
    return this.surveys.createLink(actorOf(req), id, dto);
  }

  @Delete(':id/links/:linkId')
  deleteLink(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.surveys.deleteLink(actorOf(req), id, linkId);
  }

  @Get(':id/dashboard')
  dashboard(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() f: SurveyFiltersDto,
  ) {
    return this.surveys.dashboard(actorOf(req), id, f);
  }

  @Get(':id/responses')
  responses(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() f: SurveyFiltersDto,
  ) {
    return this.surveys.responses(actorOf(req), id, f);
  }

  @Get(':id/responses.csv')
  async csv(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() f: SurveyFiltersDto,
    @Res() res: Response,
  ) {
    const { filename, body } = await this.surveys.exportCsv(
      actorOf(req),
      id,
      f,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(body);
  }

  @Get(':id/responses/:responseId/matches')
  matches(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
  ) {
    return this.surveys.memberSuggestions(actorOf(req), id, responseId);
  }

  @Patch(':id/responses/:responseId/member')
  linkMember(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
    @Body() dto: LinkMemberDto,
  ) {
    return this.surveys.linkMember(actorOf(req), id, responseId, dto.memberId);
  }

  @Delete(':id/responses/:responseId/member')
  unlinkMember(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
  ) {
    return this.surveys.unlinkMember(actorOf(req), id, responseId);
  }

  @Get(':id/volunteers')
  volunteers(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('subject') subject?: string,
  ) {
    return this.surveys.volunteers(actorOf(req), id, subject);
  }

  @Get(':id/sessions')
  sessions(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.surveys.sessions(actorOf(req), id);
  }

  @Post(':id/sessions')
  createSession(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLearningSessionDto,
  ) {
    return this.surveys.createSession(actorOf(req), id, dto);
  }

  @Patch(':id/sessions/:eventId/reward')
  reward(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: SessionRewardDto,
  ) {
    return this.surveys.setReward(
      actorOf(req),
      id,
      eventId,
      dto.given,
      dto.note,
    );
  }
}

/** Client IP for the in-memory rate limit only (never stored). */
function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim();
  return first || req.ip || req.socket?.remoteAddress || 'unknown';
}

/** Public survey: no login, published surveys only, never returns answers. */
@Controller('mobile/surveys')
@ApiTags('mobile-surveys')
export class SurveysPublicController {
  constructor(private readonly surveys: SurveysPublicService) {}

  @Get(':org/:slug')
  get(@Param('org') org: string, @Param('slug') slug: string) {
    return this.surveys.get(org, slug);
  }

  @Post(':org/:slug/visit')
  visit(
    @Param('org') org: string,
    @Param('slug') slug: string,
    @Body() dto: SurveyVisitDto,
    @Req() req: Request,
  ) {
    return this.surveys.visit(org, slug, dto, clientIp(req));
  }

  @Post(':org/:slug/start')
  start(
    @Param('org') org: string,
    @Param('slug') slug: string,
    @Body() dto: SurveyStartDto,
  ) {
    return this.surveys.start(org, slug, dto.visitorKey);
  }

  @Post(':org/:slug/responses')
  submit(
    @Param('org') org: string,
    @Param('slug') slug: string,
    @Body() dto: SubmitSurveyDto,
    @Req() req: Request,
  ) {
    return this.surveys.submit(org, slug, dto, clientIp(req));
  }
}
