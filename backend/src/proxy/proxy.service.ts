import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { BookSeatsDto } from './books.dtos';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'https://api-sa.seatsio.net',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.SEATSIO_SECRET_KEY}:`).toString('base64')
      },
      timeout: 5000,
    });
  }

 // src/proxy/proxy.service.ts
async bookSeats(data: BookSeatsDto) {
  try {
    const url = `/events/${data.eventKey}/actions/book`;
    const payload = {
      objects: data.seats,
      orderId: `order-${Date.now()}`,
      // Retirez ignoreSocialDistancing qui cause l'erreur 400
      // Ajoutez d'autres paramètres valides selon la doc Seatsio si nécessaire
    };

    this.logger.debug(`Requête vers Seatsio: ${url}`, payload);
    
    const response = await this.axiosInstance.post(url, payload);
    return response.data;
    
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      const errorData = axiosError.response.data as any;
      const errorMessage = errorData.errors?.[0]?.message || 
                         errorData.message || 
                         `Erreur ${axiosError.response.status}`;
      
      this.logger.error(`Erreur Seatsio: ${errorMessage}`, {
        request: { url: axiosError.config?.url, data: axiosError.config?.data },
        response: errorData
      });
      
      throw new Error(errorMessage);
    }
    
    throw new Error('Erreur de connexion au service de réservation');
  }
}
}