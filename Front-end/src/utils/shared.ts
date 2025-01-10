import { differenceInHours } from "date-fns";

export function getHourDifference(date1: Date, date2: Date) {
  // Parse the dates (if needed, they can already be Date objects)
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Calculate the difference in hours
  return differenceInHours(d2, d1);
}
