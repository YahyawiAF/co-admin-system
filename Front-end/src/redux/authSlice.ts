import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Définir un type pour l'état
interface AuthState {
  user: any | null; // Remplacez `any` par le type approprié pour `user`, si vous avez un modèle spécifique pour `user`
  token: string | null;
}

// État initial
const initialState: AuthState = {
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Définir l'action setUser avec un payload
    setUser: (state, action: PayloadAction<{ user: any; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    // Définir l'action signOut
    signOut: (state) => {
      state.user = null;
      state.token = null;
    },
  },
});

export const { setUser, signOut } = authSlice.actions;
export default authSlice.reducer;
