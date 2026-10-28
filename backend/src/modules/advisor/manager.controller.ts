import { Body, Controller, Get, Param, Patch, Put, Query, Req } from '@nestjs/common';
import { ManagerService } from './manager.service';

/** Conseiller « Questions » and « Argent » tabs: the owner's answers and the keep / invest calculation. */
@Controller('advisor/manager')
export class ManagerController {
  constructor(private readonly manager: ManagerService) {}

  @Get('questions')
  questions(@Query('facilityId') facilityId?: string) {
    return this.manager.questions(facilityId);
  }

  @Put('answers/:key')
  answer(
    @Query('facilityId') facilityId: string | undefined,
    @Param('key') key: string,
    @Body() body: { value?: number | null; label?: string; note?: string | null; unknown?: boolean },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    return this.manager.answer(facilityId, key, body, req.user?.userId || req.user?.sub);
  }

  @Get('money')
  money(@Query('facilityId') facilityId?: string) {
    return this.manager.money(facilityId);
  }

  @Patch('features/:key')
  feature(
    @Query('facilityId') facilityId: string | undefined,
    @Param('key') key: string,
    @Body() body: { stage: string },
  ) {
    return this.manager.setFeatureStage(facilityId, key, body.stage);
  }
}
