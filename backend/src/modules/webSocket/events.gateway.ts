import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('events')
  findAll(@MessageBody() data: any): Observable<WsResponse<number>> {
    return from([1, 2, 3]).pipe(
      map((item) => ({ event: 'events', data: item })),
    );
  }

  sendTableUpdates(data: any) {
    this.server.sockets.emit('table_updates', data);
  }

  sendVisitRequest(data: any) {
    this.server.sockets.emit('visit_request', data);
  }

  sendVisitRequestResolved(data: any) {
    this.server.sockets.emit('visit_request_resolved', data);
  }

  sendVisitorCheckout(data: any) {
    this.server.sockets.emit('visitor_checkout', data);
  }

  sendProductOrder(data: any) {
    this.server.sockets.emit('product_order', data);
  }

  sendProductUpdated(data: any) {
    this.server.sockets.emit('product_updated', data);
  }

  sendCommunityMessage(data: any) {
    this.server.sockets.emit('community_message', data);
  }

  sendStaffMessage(data: any) {
    this.server.sockets.emit('staff_message', data);
  }

  @SubscribeMessage('identity')
  async identity(@MessageBody() data: number): Promise<number> {
    return data;
  }
}
