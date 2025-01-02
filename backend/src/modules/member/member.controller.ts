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
    @Query('page') page: number,
    @Query('perPage') perPage: number,
  ): Promise<PaginatedResult<MemberEntity>> {
    return await this.memberService.findMany({ page, perPage });
  }

  @Get('all')
  // @Roles([Role.ADMIN])
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberEntity, isArray: true })
  async findAll(): Promise<MemberEntity[]> {
    return await this.memberService.findAll();
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
  @Roles([Role.ADMIN])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: MemberEntity })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ): Promise<MemberEntity> {
    return await this.memberService.update(id, updateMemberDto);
  }

  @Delete(':id')
  @Roles([Role.ADMIN])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberEntity })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<MemberEntity> {
    return await this.memberService.remove(id);
  }
}
