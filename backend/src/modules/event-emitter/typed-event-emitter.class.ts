import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface EventPayloads {
  'user.welcome': { name: string; email: string };
  'user.reset-password': { name: string; email: string; link: string };
  'user.verify-email': { name: string; email: string; otp: string };
  'status.create': {
    email: string;
    listid: string;
    bounce_type: string;
    bounce_text: string;
    timestamp: string;
    sendid: string;
  };
  'status.notification': {
    email: string;
    listid: string;
    bounce_type: string;
    bounce_text: string;
    timestamp: string;
    sendid: string;
    status: string;
  };
  'mail.notification': any;
}
@Injectable()
export class TypedEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit<K extends keyof EventPayloads>(
    event: K,
    payload: EventPayloads[K],
  ): boolean {
    return this.eventEmitter.emit(event, payload);
  }
}
