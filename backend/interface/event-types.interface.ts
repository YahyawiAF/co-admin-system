export interface EventPayloads {
  'user.welcome': { name: string; email: string };
  'user.reset-password': { name: string; email: string; link: string };
  'user.verify-email': { name: string; email: string; otp: string };
  'status.notification': {
    email: string;
    listid: string;
    bounce_type: string;
    bounce_text: string;
    timestamp: string;
    sendid: string;
    status: string;
  };
  'mail.notification': {
    campagn: {
      email: string;
      listid: string;
      bounce_type: string;
      bounce_text: string;
      timestamp: string;
      sendid: string;
      status: string;
    };
    greenArrowRespons: any;
  };
}
