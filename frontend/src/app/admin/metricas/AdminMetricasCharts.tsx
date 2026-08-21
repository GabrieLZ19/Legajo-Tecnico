"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { Search } from "lucide-react";

type BarItem = {
  name: string;
  fullName: string;
  cumplimiento: number;
  color: string;
};

type ActivityItem = {
  name: string;
  value: number;
  color: string;
};

type AdminMetricasChartsProps = {
  barData: BarItem[];
  activityData: ActivityItem[];
  totalActividad: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
};

export default function AdminMetricasCharts({
  barData,
  activityData,
  totalActividad,
  searchTerm,
  onSearchTermChange,
}: AdminMetricasChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white rounded-4xl p-8 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-black text-slate-900">
            Cumplimiento Individual
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar empresa..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-200 outline-none transition-all w-48"
            />
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              barSize={40}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#F1F5F9"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: "#64748B" }}
                dy={10}
              />
              <YAxis hide domain={[0, 110]} />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {payload[0].payload.fullName}
                        </p>
                        <p className="text-sm font-bold mt-1">
                          {payload[0].value}% de cumplimiento
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="cumplimiento" radius={[10, 10, 10, 10]}>
                {barData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    fillOpacity={0.9}
                  />
                ))}
                <LabelList
                  dataKey="cumplimiento"
                  position="top"
                  formatter={(val: any) => `${val}%`}
                  style={{
                    fontSize: "10px",
                    fontWeight: 900,
                    fill: "#64748B",
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-4xl p-8 shadow-sm border border-slate-100 flex flex-col">
        <h3 className="text-lg font-black text-slate-900 mb-2">
          Distribución de Actividad
        </h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
          Total Gestión
        </p>

        <div className="h-64 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={activityData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={90}
                paddingAngle={8}
                dataKey="value"
              >
                {activityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                        <p className="text-xs font-black text-slate-900">
                          {payload[0].name}
                        </p>
                        <p className="text-sm font-bold text-blue-600">
                          {payload[0].value} registros
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-slate-900">
              {totalActividad}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total
            </span>
          </div>
        </div>

        <div className="mt-auto space-y-3">
          {activityData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-bold text-slate-700">
                  {item.name}
                </span>
              </div>
              <span className="text-xs font-black text-slate-900">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
