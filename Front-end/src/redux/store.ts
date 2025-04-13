import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import {
  membersServerApi,
  journalServerApi,
  authServerApi,
} from "src/api";
import { priceApi } from "src/api/price.repo";
import { abonnementApi } from "src/api/abonnement.repo";
import { userServices } from "src/api/user.repo";

// Configuration du store
export const store = configureStore({
  reducer: {
    [membersServerApi.reducerPath]: membersServerApi.reducer,
    [journalServerApi.reducerPath]: journalServerApi.reducer,
    [authServerApi.reducerPath]: authServerApi.reducer,
    [priceApi.reducerPath]: priceApi.reducer,
    [abonnementApi.reducerPath]: abonnementApi.reducer,
    [userServices.reducerPath]: userServices.reducer, // ✅ Ajout du reducer pour usersApi
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      membersServerApi.middleware,
      journalServerApi.middleware,
      authServerApi.middleware,
      priceApi.middleware,
      abonnementApi.middleware,
      userServices.middleware // ✅ Ajout du middleware pour usersApi
    ),
});

// Initialisation des listeners pour le cache de RTK Query
setupListeners(store.dispatch);

// Typings Redux
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
