import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  ErpCreated,
  ErpCustomerPayload,
  ErpInvoicePayload,
  ErpPaymentPayload,
  ErpProductPayload,
} from './types';

type Session = { accessToken: string; refreshToken: string; expiresAt: number };

/**
 * Logs into supply-chain-pro with the user's own account and calls its existing
 * REST API (customers/products/invoices/payments) — that project's code is never touched.
 */
@Injectable()
export class ErpClientService {
  private readonly logger = new Logger(ErpClientService.name);
  private session: Session | null = null;
  private loginPromise: Promise<Session> | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return (this.config.get<string>('ERP_API_URL') || '').replace(/\/$/, '');
  }

  isEnabled(): boolean {
    return (
      this.config.get<string>('ERP_SYNC_ENABLED') === 'true' &&
      !!this.baseUrl &&
      !!this.config.get<string>('ERP_EMAIL') &&
      !!this.config.get<string>('ERP_PASSWORD')
    );
  }

  private async login(): Promise<Session> {
    const email = this.config.get<string>('ERP_EMAIL');
    const password = this.config.get<string>('ERP_PASSWORD');
    const res = await firstValueFrom(
      this.http.post<{ accessToken: string; refreshToken: string }>(
        `${this.baseUrl}/auth/login`,
        { email, password },
      ),
    );
    const session: Session = {
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
      // Server default access-token expiry is 7d; refresh a day early to stay safe.
      expiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
    };
    this.session = session;
    return session;
  }

  private async getAccessToken(): Promise<string> {
    if (this.session && this.session.expiresAt > Date.now()) {
      return this.session.accessToken;
    }
    if (!this.loginPromise) {
      this.loginPromise = this.login().finally(() => {
        this.loginPromise = null;
      });
    }
    return (await this.loginPromise).accessToken;
  }

  private async request<T>(
    method: 'get' | 'post' | 'patch',
    path: string,
    body?: unknown,
    retrying = false,
  ): Promise<T> {
    const token = await this.getAccessToken();
    try {
      const res = await firstValueFrom(
        this.http.request<T>({
          method,
          url: `${this.baseUrl}${path}`,
          data: body,
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return res.data;
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 401 && !retrying) {
        this.logger.warn('ERP access token rejected — re-authenticating');
        this.session = null;
        return this.request<T>(method, path, body, true);
      }
      throw error;
    }
  }

  createCustomer(payload: ErpCustomerPayload) {
    return this.request<ErpCreated>('post', '/customers', payload);
  }

  updateCustomer(id: string, payload: Partial<ErpCustomerPayload>) {
    return this.request<ErpCreated>('patch', `/customers/${id}`, payload);
  }

  createProduct(payload: ErpProductPayload) {
    return this.request<ErpCreated>('post', '/products', payload);
  }

  updateProduct(id: string, payload: Partial<ErpProductPayload>) {
    return this.request<ErpCreated>('patch', `/products/${id}`, payload);
  }

  createInvoice(payload: ErpInvoicePayload) {
    return this.request<ErpCreated>('post', '/invoices', payload);
  }

  updateInvoice(id: string, payload: Partial<ErpInvoicePayload>) {
    return this.request<ErpCreated>('patch', `/invoices/${id}`, payload);
  }

  createPayment(payload: ErpPaymentPayload) {
    return this.request<ErpCreated>('post', '/sales/payments', payload);
  }
}
