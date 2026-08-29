import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VisitRequestStatus } from '@prisma/client';
import { MobileService } from './mobile.service';
import {
  BookSpaceDto,
  CheckoutSessionDto,
  ClaimSeatDto,
  CreateCommunityMessageDto,
  CreateMobileOrderDto,
  CreateStaffMessageDto,
  CreateVisitRequestDto,
  MobileLoginDto,
  MobileRegisterDto,
  QuickCheckInDto,
  QuickRegisterDto,
  ScanInDto,
  StartDaySessionDto,
  StartSubscriptionDto,
  UpdateMobileOrderDto,
  UpdateMobileProfileDto,
  MoveSeatDto,
} from './dtos/mobile.dto';
import { PriceService } from '../price/price.service';

@Controller('mobile')
@ApiTags('mobile')
export class MobileController {
  constructor(
    private readonly mobileService: MobileService,
    private readonly priceService: PriceService,
  ) {}

  @Post('auth/register')
  register(@Body() dto: MobileRegisterDto) {
    return this.mobileService.register(dto);
  }

  @Post('auth/login')
  login(@Body() dto: MobileLoginDto) {
    return this.mobileService.login(dto);
  }

  @Post('auth/pin-login')
  pinLogin(@Body() body: { phone: string; pin: string }) {
    return this.mobileService.loginWithPin(body);
  }

  @Post('auth/set-pin')
  setPin(@Body() body: { memberId: string; pin: string }) {
    return this.mobileService.setPin(body);
  }

  @Post('auth/magic-consume')
  magicConsume(
    @Body() body: { token?: string; shortCode?: string; phone?: string },
  ) {
    return this.mobileService.consumeLoginToken(body);
  }

  @Post('admin/members/:id/login-token')
  createLoginToken(@Param('id', ParseUUIDPipe) id: string) {
    return this.mobileService.createLoginToken(id);
  }

  @Post('auth/quick-register')
  quickRegister(@Body() dto: QuickRegisterDto) {
    return this.mobileService.quickRegister(dto);
  }

  @Get('tarifs')
  tarifs() {
    return this.priceService.findAll();
  }

  @Get('seat-settings')
  seatSettings(@Query('org') org?: string) {
    return this.mobileService.getSeatSettings(org);
  }

  @Get('floor-plan')
  floorPlan(@Query('org') org?: string) {
    return this.mobileService.getFloorPlanForVisitor(org);
  }

  @Get('status/:memberId')
  async status(@Param('memberId', ParseUUIDPipe) memberId: string) {
    const status = await this.mobileService.getStatus(memberId);
    return {
      ...status,
      session: await this.mobileService.enrichSessionWithSeat(
        status.session as any,
      ),
    };
  }

  @Get('history/:memberId')
  history(@Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.mobileService.getVisitHistory(memberId);
  }

  @Patch('profile')
  updateProfile(@Body() dto: UpdateMobileProfileDto) {
    return this.mobileService.updateProfile(dto);
  }

  @Get('community')
  community(@Query('memberId') memberId?: string) {
    return this.mobileService.listCommunity(memberId);
  }

  @Get('products')
  products() {
    return this.mobileService.listProducts();
  }

  @Post('order')
  createOrder(@Body() dto: CreateMobileOrderDto) {
    return this.mobileService.createOrder(dto);
  }

  @Patch('order/:id')
  updateOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMobileOrderDto,
  ) {
    return this.mobileService.updateOrder(id, dto.memberId, dto.quantity ?? 1);
  }

  @Patch('order/:id/cancel')
  cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { memberId: string },
  ) {
    return this.mobileService.cancelOrder(id, body.memberId);
  }

  @Get('orders/:memberId')
  orders(@Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.mobileService.listOrders(memberId);
  }

  @Get('admin/orders')
  adminOrders(@Query('date') date?: string) {
    return this.mobileService.listAdminOrders(date);
  }

  @Get('admin/orders/pending')
  pendingOrders() {
    return this.mobileService.listPendingOrders();
  }

  @Patch('admin/orders/:id/confirm')
  confirmOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.mobileService.confirmOrder(id);
  }

  @Patch('admin/orders/:id/reject')
  rejectOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.mobileService.rejectOrderAdmin(id);
  }

  @Patch('admin/orders/:id/pay')
  payOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isPayed: boolean },
  ) {
    return this.mobileService.setOrderPaid(id, !!body.isPayed);
  }

  @Patch('admin/orders/pay-member-day')
  payMemberDay(@Body() body: { memberId: string; isPayed: boolean }) {
    return this.mobileService.payMemberDayOrders(body.memberId, !!body.isPayed);
  }

  @Get('admin/visitor-day/:memberId')
  visitorDay(@Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.mobileService.visitorDay(memberId);
  }

  @Get('messages/:memberId')
  inbox(@Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.mobileService.listInbox(memberId);
  }

  @Get('messages/:memberId/thread/:peerId')
  thread(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('peerId', ParseUUIDPipe) peerId: string,
  ) {
    return this.mobileService.thread(memberId, peerId);
  }

  @Post('messages')
  sendMessage(@Body() dto: CreateCommunityMessageDto) {
    return this.mobileService.sendMessage(dto);
  }

  @Get('resume')
  resume(@Query('phone') phone: string) {
    return this.mobileService.resumeByPhone(phone);
  }

  @Post('session/start')
  startSession(@Body() dto: StartDaySessionDto) {
    return this.mobileService.startDaySession(dto);
  }

  @Post('session/scan-in')
  scanIn(@Body() dto: ScanInDto) {
    return this.mobileService.scanIn(dto.memberId);
  }

  @Post('session/claim-seat')
  claimSeat(@Body() dto: ClaimSeatDto) {
    return this.mobileService.claimSeat(
      dto.memberId,
      dto.seatLabel,
      dto.spaceId,
    );
  }

  @Patch('session/:id/checkout')
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckoutSessionDto,
  ) {
    return this.mobileService.checkoutSession(id, dto);
  }

  @Patch('session/:id/payment')
  setPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isPayed: boolean },
  ) {
    return this.mobileService.setPaymentStatus(id, !!body.isPayed);
  }

  @Post('subscription/start')
  startSubscription(@Body() dto: StartSubscriptionDto) {
    return this.mobileService.startSubscription(dto);
  }

  @Post('admin/quick-checkin')
  quickCheckIn(@Body() dto: QuickCheckInDto) {
    return this.mobileService.quickCheckIn(dto);
  }

  @Post('admin/book-space')
  bookSpace(@Body() dto: BookSpaceDto) {
    if (!dto.spaceId && !dto.kind && !dto.tableId) {
      throw new BadRequestException('spaceId, tableId or kind is required');
    }
    return this.mobileService.bookSeatsForMemberByKind(dto.memberId, {
      spaceId: dto.spaceId,
      kind: dto.kind,
      tableId: dto.tableId,
    });
  }

  @Post('admin/move-seat')
  moveSeat(@Body() dto: MoveSeatDto) {
    return this.mobileService.moveSeat(dto);
  }

  @Post('visit-request')
  createVisitRequest(@Body() dto: CreateVisitRequestDto) {
    return this.mobileService.createVisitRequest(dto);
  }

  @Get('visit-request/:id')
  getVisitRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.mobileService.getVisitRequest(id);
  }

  @Get('admin/visit-requests')
  listVisitRequests(@Query('status') status?: VisitRequestStatus) {
    return this.mobileService.listVisitRequests(status);
  }

  @Patch('admin/visit-requests/:id/approve')
  approveVisitRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { seatLabel?: string; spaceId?: string },
  ) {
    return this.mobileService.approveVisitRequest(
      id,
      body?.seatLabel,
      body?.spaceId,
    );
  }

  @Patch('admin/visit-requests/:id/reject')
  rejectVisitRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.mobileService.rejectVisitRequest(id);
  }

  @Patch('visit-request/:id/cancel')
  cancelVisitRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { memberId: string },
  ) {
    return this.mobileService.cancelVisitRequest(id, body.memberId);
  }

  @Post('admin/staff-message')
  sendStaffMessage(@Body() dto: CreateStaffMessageDto) {
    return this.mobileService.sendStaffMessage(dto);
  }

  @Post('staff-message')
  sendVisitorStaffMessage(
    @Body() body: { memberId: string; text: string },
  ) {
    return this.mobileService.sendVisitorToStaff(body);
  }

  @Get('admin/staff-inbox')
  staffInbox() {
    return this.mobileService.listStaffInbox();
  }

  @Patch('staff-thread/:memberId/read')
  markStaffThreadRead(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: { as?: 'member' | 'staff' },
  ) {
    return this.mobileService.markStaffThreadRead(
      memberId,
      body.as === 'staff' ? 'staff' : 'member',
    );
  }

  @Get('staff-messages/:memberId')
  listStaffMessages(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Query('unread') unread?: string,
  ) {
    return this.mobileService.listStaffMessages(memberId, unread === '1');
  }

  @Patch('staff-messages/:id/read')
  markStaffMessageRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.mobileService.markStaffMessageRead(id);
  }

  @Get('push/vapid-public-key')
  vapidPublicKey() {
    return this.mobileService.getVapidPublicKey();
  }

  @Post('push/subscribe')
  pushSubscribe(
    @Body()
    body: {
      memberId: string;
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    return this.mobileService.savePushSubscription(body);
  }

  @Post('push/unsubscribe')
  pushUnsubscribe(@Body() body: { memberId?: string; endpoint: string }) {
    return this.mobileService.removePushSubscription(body);
  }
}
