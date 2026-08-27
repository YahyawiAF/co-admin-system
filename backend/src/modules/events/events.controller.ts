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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SpaceEventsService } from './events.service';
import {
  CreateEventDto,
  EventAttendanceDto,
  EventFeedbackDto,
  EventMemberDto,
  UpdateEventDto,
} from './dtos/event.dto';

@Controller('events')
@ApiTags('events')
export class EventsAdminWriteController {
  constructor(private readonly eventsService: SpaceEventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.cancel(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }
}

@Controller('admin/events')
@ApiTags('events')
export class EventsAdminReadController {
  constructor(private readonly eventsService: SpaceEventsService) {}

  @Get()
  list() {
    return this.eventsService.adminList();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.adminGet(id);
  }

  @Patch(':id/attendance')
  attendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EventAttendanceDto,
  ) {
    return this.eventsService.markAttendance(id, dto.code);
  }
}

@Controller('mobile/events')
@ApiTags('mobile-events')
export class MobileEventsController {
  constructor(private readonly eventsService: SpaceEventsService) {}

  @Get()
  list(@Query('org') org?: string, @Query('when') when?: 'upcoming' | 'past') {
    return this.eventsService.listPublic(
      org,
      when === 'past' ? 'past' : 'upcoming',
    );
  }

  @Get(':id/attendees')
  attendees(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.eventsService.attendees(id, memberId);
  }

  @Get(':id')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('memberId') memberId?: string,
  ) {
    return this.eventsService.getPublic(id, memberId);
  }

  @Post(':id/register')
  register(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EventMemberDto,
  ) {
    return this.eventsService.register(id, dto.memberId);
  }

  @Delete(':id/register')
  unregister(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('memberId') memberId: string,
  ) {
    return this.eventsService.unregister(id, memberId);
  }

  @Post(':id/feedback')
  feedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EventFeedbackDto,
  ) {
    return this.eventsService.feedback(id, dto);
  }
}
