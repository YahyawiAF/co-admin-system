import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { membersServerApi, journalServerApi, authServerApi } from "src/api";  // Ajouter authServerApi ici

export const store = configureStore({
  reducer: {
    [membersServerApi.reducerPath]: membersServerApi.reducer,
    [journalServerApi.reducerPath]: journalServerApi.reducer,
    [authServerApi.reducerPath]: authServerApi.reducer,  // Ajouter authServerApi ici
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat([  // Ajouter le middleware pour authServerApi
      membersServerApi.middleware,
      journalServerApi.middleware,
      authServerApi.middleware,  // Ajouter authServerApi.middleware ici
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
