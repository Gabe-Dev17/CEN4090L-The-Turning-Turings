//users progressscreen
//able to track and log weight(Ibs) by date
//users progress will be shown with a chart
//the Y access will be the users weight
//the X axis will be the date it was added
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Plus } from "lucide-react";
import { mockWeightData } from "../data/mockFoods";

export default function Progress() {
  const [data, setData] = useState(mockWeightData);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState("");

  const handleAdd = () => {
    if (!weight || !date) return;
    setData([...data, { date, weight: Number(weight) }]);
    setWeight("");
    setDate("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Your Progress</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/*weight section*/}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Log Weight</h2>

          <label className="text-sm text-black-500">Weight: (lbs)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <label className="text-sm text-black-500">Date:</label>
          <input
            type="text"
            placeholder="7/21/2027"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <button
            onClick={handleAdd}
            className="w-full bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-2"
          >Add
          </button>
        </div>

        {/*weight chart section*/}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" domain={["dataMin - 10", "dataMax + 10"]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#39e177"
                strokeWidth={3}
                dot={{ r: 5, fill: "#22c55e" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}