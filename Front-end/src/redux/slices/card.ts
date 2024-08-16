import { createSlice } from "@reduxjs/toolkit";
import { Card } from "../../types/shared";
import { cardServerApi } from "src/api";

export interface CardState {
  cards: Card[];
}

const initialState: CardState = {
  cards: [],
};

export function fetchCount(amount = 1) {
  return new Promise<{ data: number }>((resolve) =>
    setTimeout(() => resolve({ data: amount }), 500)
  );
}

export const cardSlice = createSlice({
  name: "card",
  initialState,
  reducers: {
    createCard: (state, action) => {
      state.cards = [action.payload, ...state.cards];
    },
    updateCard: (state) => {
      state.cards = [];
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      cardServerApi.endpoints.getCard.matchFulfilled,
      (state, action) => {
        state.cards = [...action.payload, ...state.cards];
      }
    );
  },
});

export const { updateCard, createCard } = cardSlice.actions;

export default cardSlice.reducer;
