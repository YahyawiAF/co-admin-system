import {
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  setHours,
  setMinutes,
  addHours,
  addMinutes,
  addSeconds,
} from "date-fns";

export function getHourDifference(date1: Date, date2: Date) {
  // Parse the dates (if needed, they can already be Date objects)
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Calculate the difference in hours
  return differenceInHours(d2, d1);
}

export const updateHoursAndMinutes = (date: Date) => {
  const now = new Date(); // Get the current date and time
  const currentHour = now.getHours(); // Extract current hour
  const currentMinute = now.getMinutes(); // Extract current minute

  // Update the given date with current hour and minute
  const updatedDate = setMinutes(setHours(date, currentHour), currentMinute);
  return updatedDate;
};

export function adjustDateWithDifference(
  baseDate: Date,
  compareDate: Date
): Date {
  // Calculate the differences
  const hoursDifference = differenceInHours(compareDate, baseDate);
  const minutesDifference = differenceInMinutes(compareDate, baseDate) % 60; // Modulo to exclude full hours
  const secondsDifference = differenceInSeconds(compareDate, baseDate) % 60; // Modulo to exclude full minutes

  // Add the differences to the base date
  const updatedDate = addSeconds(
    addMinutes(addHours(baseDate, hoursDifference), minutesDifference),
    secondsDifference
  );

  return updatedDate;
}
