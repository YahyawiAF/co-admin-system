import { SerializedError } from "@reduxjs/toolkit";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query";

type APIError = {
  statusCode: number;
  message: string;
};

export const parseErrorMessage = (
  error: FetchBaseQueryError | SerializedError
): string => {
  if (!error) return "An unknown error occurred.";

  if ("data" in error) {
    return (error.data as APIError)?.message;
  }

  return "An unexpected error occurred.";
};
