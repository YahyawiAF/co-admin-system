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

export function getHourDifference(date1: Date, date2: Date): string {
  // Parse the dates (if needed, they can already be Date objects)
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Calculate the total difference in minutes
  const totalMinutes = differenceInMinutes(d2, d1);
  
  // Handle negative difference (date2 before date1)
  if (totalMinutes < 0) return "0min";

  // Calculate hours and remaining minutes
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Format the result
  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}min`;
  }
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
