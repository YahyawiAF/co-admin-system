import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { membersServerApi, journalServerApi, authServerApi } from "src/api";
import { priceApi } from "src/api/price.repo";
import { abonnementApi } from "src/api/abonnement.repo";

// Configuration du store
export const store = configureStore({
  reducer: {
    [membersServerApi.reducerPath]: membersServerApi.reducer,
    [journalServerApi.reducerPath]: journalServerApi.reducer,
    [authServerApi.reducerPath]: authServerApi.reducer,
    [priceApi.reducerPath]: priceApi.reducer, // Ajout de priceApi ici
    [abonnementApi.reducerPath]: abonnementApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat([
      membersServerApi.middleware,
      journalServerApi.middleware,
      authServerApi.middleware,
      priceApi.middleware, // Ajout de priceApi.middleware ici
      abonnementApi.middleware,
    ]),
});

// Initialisation des listeners pour le cache de RTK Query
setupListeners(store.dispatch);

// Typing pour AppDispatch et RootState
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

// Typing pour un thunk asynchrone dans Redux
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
