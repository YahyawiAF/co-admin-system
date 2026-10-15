import { SyncProcessorService } from './sync-processor.service';

// Jest here has no `database/*` path alias; the service only needs the type.
jest.mock('database/prisma.service', () => ({ PrismaService: class {} }), {
  virtual: true,
});

/** In-memory SyncMapping + a fake supply-chain-pro client that records its calls. */
function setup() {
  const maps = new Map<string, string>();
  const mapping = {
    get: jest.fn(async (type: string, id: string) =>
      maps.has(`${type}:${id}`)
        ? { externalId: maps.get(`${type}:${id}`)!, syncedAt: new Date() }
        : null,
    ),
    set: jest.fn(async (type: string, id: string, ext: string) => {
      maps.set(`${type}:${id}`, ext);
    }),
  };
  maps.set('price:price-1', 'erp-prod-1');
  maps.set('walkInCustomer:default', 'erp-walkin');
  const erp = {
    createOrder: jest.fn().mockResolvedValue({ id: 'erp-ord-1' }),
    updateOrder: jest.fn(),
    createInvoice: jest.fn().mockResolvedValue({ id: 'erp-inv-x' }),
    createInvoiceFromOrder: jest.fn().mockResolvedValue({ id: 'erp-inv-1' }),
    updateInvoice: jest.fn(),
    createPayment: jest.fn().mockResolvedValue({ id: 'erp-pay-1' }),
  };
  const journal = {
    id: 'j-1',
    isAnonymous: true,
    memberID: null,
    priceId: 'price-1',
    payedAmount: 2.8,
    paidAmount: 2.8,
    paidAt: new Date('2026-10-15T09:00:00Z'),
    registredTime: new Date('2026-10-15T08:00:00Z'),
    serviceName: 'Visite coworking',
    guestName: 'two girls',
  };
  const prisma = {
    journal: { findUnique: jest.fn().mockResolvedValue(journal) },
  };
  const service = new SyncProcessorService(
    prisma as any,
    erp as any,
    mapping as any,
  );
  return { service, erp, maps };
}

describe('SyncProcessorService — one sale, one créance', () => {
  it('sends the order, then the invoice made from it, then the payment on that invoice', async () => {
    const { service, erp, maps } = setup();
    await (service as any).syncJournal('j-1');

    expect(erp.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaid: 0, total: 2.8 }),
    );
    expect(erp.createInvoiceFromOrder).toHaveBeenCalledWith('erp-ord-1', {
      issueDate: '2026-10-15T08:00:00.000Z',
      dueDate: '2026-10-15T08:00:00.000Z',
    });
    expect(erp.createInvoice).not.toHaveBeenCalled();
    expect(erp.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'erp-inv-1', amount: 2.8 }),
    );
    expect(maps.get('journal:j-1')).toBe('erp-inv-1');
    expect(maps.get('journalOrder:j-1')).toBe('erp-ord-1');
  });

  it('a second sync updates the same records, creates nothing new', async () => {
    const { service, erp } = setup();
    await (service as any).syncJournal('j-1');
    await (service as any).syncJournal('j-1');

    expect(erp.createOrder).toHaveBeenCalledTimes(1);
    expect(erp.createInvoiceFromOrder).toHaveBeenCalledTimes(1);
    expect(erp.createPayment).toHaveBeenCalledTimes(1);
    expect(erp.updateOrder).toHaveBeenCalledWith(
      'erp-ord-1',
      expect.anything(),
    );
    expect(erp.updateInvoice).toHaveBeenCalledWith(
      'erp-inv-1',
      expect.not.objectContaining({ amountDue: expect.anything() }),
    );
  });
});
