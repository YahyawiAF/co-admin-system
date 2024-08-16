import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { User } from "../../types/shared";

export interface MembersState {
  members: User[];
}

const initialState: MembersState = {
  members: [],
};

export function fetchCount(amount = 1) {
  return new Promise<{ data: number }>((resolve) =>
    setTimeout(() => resolve({ data: amount }), 500)
  );
}

export const incrementAsync = createAsyncThunk(
  "members/fetchCoun",
  async (amount: number) => {
    const response = await fetchCount(amount);
    return response.data;
  }
);

export const membersSlice = createSlice({
  name: "members",
  initialState,
  reducers: {
    createUser: (state, action) => {
      state.members = [action.payload, ...state.members];
    },
    editeUser: (state, action) => {
      let index = state.members.findIndex(
        (user) => user.fullName === action.payload.fullName
      );

      if (index !== -1) {
        state.members[index] = action.payload;
        // state.members = [action.payload, ...state.members];
      }
    },
    deleteUsers: (state) => {
      state.members = [];
    },
  },
});

export const { createUser, deleteUsers, editeUser } = membersSlice.actions;

export default membersSlice.reducer;
