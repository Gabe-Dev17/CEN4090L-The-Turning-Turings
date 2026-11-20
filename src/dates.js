//dates are YYYY-MM-DD strings in local time, same as the db.
//(toISOString() gives the UTC date, which is tomorrow after 7-8pm in florida)

const pad = (n) => String(n).padStart(2, "0");

function toStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

//noon so daylight saving can't push it into another day
function fromStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export const today = () => toStr(new Date());

export const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function addDays(s, n) {
  const d = fromStr(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
}

//ex: Tue, Nov 3, 2026
export const niceDate = (s) =>
  fromStr(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

//"2026-11-03" -> "11/3"
export const shortDate = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

//"18:30" -> "6:30 PM"
export function niceTime(t) {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
