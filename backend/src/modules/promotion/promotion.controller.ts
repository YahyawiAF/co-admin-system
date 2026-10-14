import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PromotionService } from './promotion.service';

type Body_ = Parameters<PromotionService['create']>[1];

@Controller()
export class PromotionController {
  constructor(private readonly promotions: PromotionService) {}

  @Get('promotions')
  list(@Query('facilityId') facilityId?: string) {
    return this.promotions.list(facilityId);
  }

  @Post('promotions')
  create(@Query('facilityId') facilityId: string | undefined, @Body() body: Body_) {
    return this.promotions.create(facilityId, body);
  }

  @Patch('promotions/:id')
  update(@Param('id') id: string, @Body() body: Body_) {
    return this.promotions.update(id, body);
  }

  @Delete('promotions/:id')
  remove(@Param('id') id: string) {
    return this.promotions.remove(id);
  }

  /** Member app: live offers for this member (golden card popup). */
  @Get('mobile/promotions')
  forMember(@Query('orgSlug') orgSlug: string, @Query('memberId') memberId?: string) {
    return this.promotions.forMember(orgSlug, memberId || null);
  }

  @Post('mobile/promotions/:id/track')
  track(@Param('id') id: string, @Body() body: { kind?: string }) {
    return this.promotions.track(id, body?.kind === 'click' ? 'click' : 'view');
  }
}
