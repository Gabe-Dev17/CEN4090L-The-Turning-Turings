//usda fooddata central, used to find foods that aren't in our database.
//api docs: https://fdc.nal.usda.gov/api-guide
//the key only ever lives on the server (FDC_API_KEY in server/.env), never in react.

const BASE = 'https://api.nal.usda.gov/fdc/v1';

// generic foods ("Quinoa, cooked") are more useful for logging meals than packaged
// products, so those get searched first and branded ones only fill the leftover spots
const GENERIC = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'];
const BRANDED = ['Branded'];
const MAX_RESULTS = 10;
const MAX_NAME = 100;

// calories show up under different nutrient ids depending on the data type,
// so check them in this order and only take ones measured in kcal
const KCAL_IDS = [1008, 2047, 2048];

// fdc sends some characters html-encoded, like &#38; for &
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const isUpper = (s) => s === s.toUpperCase() && s !== s.toLowerCase();
const isLower = (s) => s === s.toLowerCase() && s !== s.toUpperCase();

// "CHEDDAR CHEESE" -> "Cheddar cheese"
function sentenceCase(s) {
  return isUpper(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

// "KROGER" or "kroger" -> "Kroger", but "IMG Holdings Inc." is left alone
function titleCase(s) {
  if (!isUpper(s) && !isLower(s)) return s;
  return s.toLowerCase().replace(/(^|[\s(&/-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

// cuts long names at a space instead of the middle of a word
function shorten(s) {
  if (s.length <= MAX_NAME) return s;
  const cut = s.slice(0, MAX_NAME - 1);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : cut).replace(/[\s,;:-]+$/, '') + '…';
}

// fdc puts this in the brand field for foods that don't have a brand
const NO_BRAND = 'not a branded item';

// one search result -> a FoodItem, or null if fdc has no calorie value for it.
// search results give nutrients per 100 g, so that's the serving unit
export function toFood(f) {
  const nutrients = f.foodNutrients || [];
  let kcal = null;
  for (const id of KCAL_IDS) {
    const n = nutrients.find((x) => x.nutrientId === id && String(x.unitName).toUpperCase() === 'KCAL');
    if (n && typeof n.value === 'number') {
      kcal = n.value;
      break;
    }
  }
  if (kcal === null || !f.description) return null;

  const desc = sentenceCase(decode(f.description).trim());
  let brand = decode(f.brandName || f.brandOwner || '').trim();
  if (brand.toLowerCase() === NO_BRAND) brand = '';

  return {
    externalId: String(f.fdcId),
    name: shorten(brand ? `${desc} (${titleCase(brand)})` : desc),
    caloriesPerServing: Math.round(kcal * 10) / 10,
    servingUnit: '100 g'
  };
}

export class NutritionApiAdapter {
  // fetchFn can be swapped out in tests so they never hit the real api
  constructor(apiKey, fetchFn = globalThis.fetch) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
  }

  async search(keyword, dataType, pageSize) {
    const res = await this.fetchFn(`${BASE}/foods/search?api_key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: keyword, pageSize, dataType }),
      signal: AbortSignal.timeout(5000)
    });
    if (res.status === 429) throw new Error('FoodData Central rate limit hit (resets within an hour)');
    if (!res.ok) throw new Error(`FoodData Central returned ${res.status}`);
    const data = await res.json();
    return (data.foods || []).map(toFood).filter(Boolean);
  }

  // searchFoods - returns FoodItems that aren't saved yet (no foodId until saveExternal).
  // generic foods first, then branded ones to fill up to 10
  async searchFoods(keyword) {
    const found = await this.search(keyword, GENERIC, MAX_RESULTS);
    if (found.length < MAX_RESULTS / 2) {
      const branded = await this.search(keyword, BRANDED, MAX_RESULTS - found.length);
      for (const f of branded) if (!found.some((g) => g.externalId === f.externalId)) found.push(f);
    }
    return found.slice(0, MAX_RESULTS);
  }
}
