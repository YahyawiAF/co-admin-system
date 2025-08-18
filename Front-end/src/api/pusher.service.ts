// src/services/pusher.service.ts
import Pusher from 'pusher-js';

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || '390a64a30ec39a72dd79';
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

export const initializePusher = () => {
  return new Pusher(pusherKey, {
    cluster: pusherCluster,
    forceTLS: true,
    authEndpoint: '/api/pusher/auth', // Nous allons créer ce endpoint
    auth: {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('accessToken')}`
      }
    }
  });
};