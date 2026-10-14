import { Member } from '@prisma/client';
import { ErpCustomerPayload } from '../types';

export function memberToCustomer(member: Member): ErpCustomerPayload {
  return {
    firstName: member.firstName?.trim() || 'Membre',
    lastName: member.lastName?.trim() || 'Coworking',
    email: member.email || undefined,
    phone: member.phone || undefined,
    // Avoid supply-chain-pro emailing the member on creation — co-admin owns that relationship.
    sendWelcomeEmail: false,
  };
}
