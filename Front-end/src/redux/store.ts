import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import membersReducer from "./slices/members";
import cardReducer from "./slices/card";
import { setupListeners } from "@reduxjs/toolkit/query";
import {
  membersServerApi,
  balancesServerApi,
  cardServerApi,
  expensesServerApi,
  transactionsServerApi,
  companiersServerApi,
} from "src/api";
export const store = configureStore({
  reducer: {
    members: membersReducer,
    cards: cardReducer,
    [membersServerApi.reducerPath]: membersServerApi.reducer,
    [balancesServerApi.reducerPath]: balancesServerApi.reducer,
    [cardServerApi.reducerPath]: cardServerApi.reducer,
    [expensesServerApi.reducerPath]: expensesServerApi.reducer,
    [transactionsServerApi.reducerPath]: transactionsServerApi.reducer,
    [companiersServerApi.reducerPath]: companiersServerApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat([
      membersServerApi.middleware,
      balancesServerApi.middleware,
      cardServerApi.middleware,
      expensesServerApi.middleware,
      transactionsServerApi.middleware,
      companiersServerApi.middleware,
    ]),
});

setupListeners(store.dispatch);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
