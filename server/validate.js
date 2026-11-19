//checks every request body before it's used. a bad one gets a 400 with the message
//and the name of the field it's about, so a form can show the error next to it
import { z } from "zod";

// optional text boxes: blank means "not filled in"
const optionalText = z
  .string()
  .trim()
  .max(100, "Keep this under 100 characters.")
  .nullish()
  .transform((v) => (v ? v : null));

// real calendar dates only, so 2026-02-30 gets caught here instead of by the db
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
  .refine((d) => !isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d, "Pick a valid date.");

//same messages as the login page
export const registerSchema = z.object({
  name: z.string({ message: "Enter your name." }).trim().min(1, "Enter your name.").max(50, "Keep your name under 50 characters."),
  email: z.string({ message: "Enter a valid email." }).trim().toLowerCase().email("Enter a valid email."),
  password: z
    .string({ message: "Use 8+ characters with a letter and a number." })
    .min(8, "Use 8+ characters with a letter and a number.")
    .max(200)
    .regex(/[A-Za-z]/, "Use 8+ characters with a letter and a number.")
    .regex(/\d/, "Use 8+ characters with a letter and a number."),
});

export const loginSchema = z.object({
  email: z.string({ message: "Enter a valid email." }).trim().toLowerCase().email("Enter a valid email."),
  password: z.string({ message: "Enter your password." }).min(1, "Enter your password."),
});

export const entrySchema = z.object({
  date: dateString,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a valid time."),
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"], { message: "Pick a meal type." }),
  mood: optionalText,
  location: optionalText,
  activity: optionalText,
  items: z
    .array(
      z.object({
        foodId: z.string().min(1),
        portion: z.number().positive("Portions have to be more than 0.").max(100, "That portion is too big.")
      })
    )
    .min(1, "Add at least one food.")
    // one item per food, so Entry.removeItem can go by food id. the form merges repeats
    .refine((items) => new Set(items.map((i) => i.foodId)).size === items.length, "Each food can only be listed once. Change its portion instead.")
});

export const dateSchema = dateString;

// query strings send "" for empty boxes, which should count as not filled in
const blankToUndefined = (v) => (v === "" ? undefined : v);
const optionalDate = z.preprocess(blankToUndefined, dateString.optional());

// EntryFilter - every field is optional, so users can search by just one thing
export const filterSchema = z
  .object({
    startDate: optionalDate,
    endDate: optionalDate,
    food: optionalText,
    mood: optionalText,
    location: optionalText,
    activity: optionalText
  })
  .refine((f) => !f.startDate || !f.endDate || f.startDate <= f.endDate, "The start date has to be on or before the end date.");

// getTrend - the last `period` days up to endDate (the browser"s today, since the server can"t know the user"s time zone)
export const trendSchema = z.object({
  endDate: dateString,
  period: z.coerce.number().int("Pick a number of days.").min(1, "Pick between 1 and 90 days.").max(90, "Pick between 1 and 90 days.")
});

export const targetSchema = z.object({
  targetCalories: z.coerce
    .number({ message: "Enter a number of calories." })
    .int("Use a whole number of calories.")
    .min(500, "Daily goals need to be at least 500 kcal.")
    .max(10000, "Daily goals need to be 10,000 kcal or less.")
});

// null (or blank) turns the reminder off
export const reminderSchema = z.object({
  reminderTime: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a valid time.").nullable()
  )
});

// runs a schema and throws a 400 with the first problem if the input is bad.
// field is the name of the bad input, so a form can show the error next to it
export function check(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw Object.assign(new Error(issue.message), { status: 400, field: issue.path[0] });
  }
  return result.data;
}

// custom foods from the Add page
export const customFoodSchema = z.object({
  name: z.string().trim().min(1, "Enter a food name.").max(100, "Keep the name under 100 characters."),
  caloriesPerServing: z.coerce
    .number({ message: "Enter the calories per serving." })
    .min(0, "Calories can't be negative.")
    .max(5000, "That's a lot of calories for one serving. Check the number."),
  servingUnit: z.string().trim().max(30, "Keep the serving size under 30 characters.").optional()
    .transform((v) => v || "serving")
});

export const waterSchema = z.object({
  date: dateString,
  ounces: z.number().int("Use whole ounces.").min(0, "Water can't go below 0.").max(400, "That's more water than one day can hold.")
});

export const weightSchema = z.object({
  date: dateString,
  pounds: z.coerce
    .number({ message: "Enter your weight." })
    .positive("Enter your weight.")
    .max(1000, "Check that weight, it looks too high.")
});

export const noteSchema = z.object({
  note: z.string().max(10000, "Diary notes can be up to 10,000 characters.")
});
