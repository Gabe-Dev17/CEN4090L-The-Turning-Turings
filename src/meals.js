//value is what the db stores (the MealType enum), label is what the page shows
export const MEALS = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snacks" },
];

export const mealLabel = (value) => MEALS.find((m) => m.value === value)?.label ?? value;

//picks a meal from the time of day, for when the user didn't pick one
export function mealForTime(time) {
  const h = Number(time.slice(0, 2));
  if (h >= 5 && h < 11) return "BREAKFAST";
  if (h >= 11 && h < 16) return "LUNCH";
  if (h >= 16 && h < 22) return "DINNER";
  return "SNACK";
}

export const cal = (n) => `${Math.round(n).toLocaleString()} cal`;

export const WATER_GOAL = 64;
