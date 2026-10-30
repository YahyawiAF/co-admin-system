import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberOnboardingService } from './member-onboarding.service';

@ApiTags('Mobile')
@Controller('mobile')
export class MemberOnboardingController {
  constructor(private readonly onboarding: MemberOnboardingService) {}

  /** Questions to ask after check-in (profile, source). */
  @Get('onboarding')
  status(@Query('memberId') memberId: string) {
    return this.onboarding.status(memberId);
  }

  @Post('onboarding')
  save(
    @Body()
    body: { memberId?: string; profileType?: string | null; heardFrom?: string | null; skipSource?: boolean },
  ) {
    return this.onboarding.save(body);
  }

  /** « Mes offres »: personal / group discounts, app gift, promotions. */
  @Get('offers')
  offers(@Query('orgSlug') orgSlug: string, @Query('memberId') memberId: string) {
    return this.onboarding.offers(orgSlug, memberId);
  }
}
