import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { membersServerApi, journalServerApi, authServerApi } from "src/api";
import { priceApi } from "src/api/price.repo";
import { abonnementApi } from "src/api/abonnement.repo";
import { userServices } from "src/api/user.repo";
import { expenseApi } from "src/api/expenseApi";
import { dailyExpenseApi } from "src/api/dailyexpenseApi";
import { productApi } from "src/api/productApi";
import { dailyProductApi } from "src/api/dailyproductApi";

// Configuration du store
export const store = configureStore({
  reducer: {
    [membersServerApi.reducerPath]: membersServerApi.reducer,
    [journalServerApi.reducerPath]: journalServerApi.reducer,
    [authServerApi.reducerPath]: authServerApi.reducer,
    [priceApi.reducerPath]: priceApi.reducer,
    [abonnementApi.reducerPath]: abonnementApi.reducer,
    [userServices.reducerPath]: userServices.reducer,
    [expenseApi.reducerPath]: expenseApi.reducer,
    [dailyExpenseApi.reducerPath]: dailyExpenseApi.reducer,
    [productApi.reducerPath]: productApi.reducer,
    [dailyProductApi.reducerPath]: dailyProductApi.reducer,

  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      membersServerApi.middleware,
      journalServerApi.middleware,
      authServerApi.middleware,
      priceApi.middleware,
      abonnementApi.middleware,
      userServices.middleware,
      expenseApi.middleware,
      dailyExpenseApi.middleware,
      productApi.middleware,
      dailyProductApi.middleware

    ),
});

// Initialisation des listeners pour le cache de RTK Query
setupListeners(store.dispatch);

// Typings Re dux
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
