import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { MemberService } from './member.service';
import { AddMemberDto } from './dtos/createMember.dto';
import { UpdateMemberDto } from './dtos/updateMember.dto';
import { MemberEntity } from './entities/member.entity';
import {
  ApiBearerAuth,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/accessToken.guard';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorator/roles.decorator';
import { RolesGuard } from '../../../common/guards/auth.guard';
import { PaginatedResult } from 'prisma-pagination';

@Controller('members')
@ApiTags('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post()
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: MemberEntity })
  async create(@Body() addMemberDto: AddMemberDto): Promise<MemberEntity> {
    const member = await this.memberService.create(addMemberDto);
    return new MemberEntity(member);
  }

  @Get()
  // @Roles([Role.ADMIN, Role.USER])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberEntity, isArray: true })
  async findMany(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: string,
    @Query('memberIds') memberIds?: string,
    @Query('profileType') profileType?: string,
    @Query('returnStatus') returnStatus?: string,
    @Query('offer') offer?: string,
  ): Promise<PaginatedResult<MemberEntity>> {
    const ids = memberIds
      ? memberIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return await this.memberService.findMany({
      page: Number(page) || 1,
      perPage: Number(perPage) || 20,
      organizationId,
      search,
      groupId,
      status,
      memberIds: ids,
      profileType,
      returnStatus,
      offer,
    });
  }

  @Get('all')
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberEntity, isArray: true })
  async findAll(
    @Query('organizationId') organizationId?: string,
  ): Promise<MemberEntity[]> {
    return await this.memberService.findAll(organizationId);
  }

  @Get('stats')
  @ApiBearerAuth()
  stats(@Query('organizationId') organizationId?: string) {
    return this.memberService.stats(organizationId);
  }

  @Get('debtors')
  @ApiBearerAuth()
  debtors(
    @Query('organizationId') organizationId?: string,
    @Query('includeSettled') includeSettled?: string,
  ) {
    return this.memberService.listDebtors(
      organizationId,
      includeSettled === '1' || includeSettled === 'true',
    );
  }

  @Get(':id/insights')
  @ApiBearerAuth()
  async insights(@Param('id', ParseUUIDPipe) id: string) {
    return this.memberService.insights(id);
  }

  @Get(':id/ledger')
  @ApiBearerAuth()
  ledger(@Param('id', ParseUUIDPipe) id: string) {
    return this.memberService.listLedger(id);
  }

  @Post(':id/ledger')
  @ApiBearerAuth()
  addLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      kind: 'CREDIT' | 'ECHEANCE';
      amount: number;
      note?: string;
      dueDate?: string;
      source?: string;
      journalId?: string;
      abonnementId?: string;
    },
  ) {
    return this.memberService.addLedger({ ...body, memberId: id });
  }

  @Patch('ledger/:entryId/settle')
  @ApiBearerAuth()
  settleLedger(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: { settled?: boolean },
  ) {
    return this.memberService.settleLedger(entryId, body.settled !== false);
  }

  @Delete('ledger/:entryId')
  @ApiBearerAuth()
  removeLedger(@Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.memberService.removeLedger(entryId);
  }

  @Post(':id/merge')
  @ApiBearerAuth()
  merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { sourceMemberId: string },
  ) {
    if (!body?.sourceMemberId) {
      throw new BadRequestException('sourceMemberId requis');
    }
    return this.memberService.mergeMembers(id, body.sourceMemberId);
  }

  @Get(':id')
  // @Roles([Role.ADMIN, Role.USER])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberEntity })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<MemberEntity> {
    return await this.memberService.findOne(id);
  }

  @Patch(':id')
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: MemberEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ): Promise<MemberEntity> {
    return await this.memberService.update(id, updateMemberDto);
  }

  @Delete(':id')
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberEntity })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<MemberEntity> {
    return await this.memberService.remove(id);
  }
}
