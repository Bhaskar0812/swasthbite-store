import api from "./api";

export const holidayService = {
  // Fetch own store holidays + global holidays for a given year
  getHolidays: async (year: number) => {
    const res = await api.get("/store/holidays", { params: { year } });
    return res.data?.data as HolidayItem[];
  },

  // Add a holiday for this store (date = "YYYY-MM-DD", label optional)
  addHoliday: async (date: string, label?: string) => {
    const res = await api.post("/store/holidays", {
      date,
      label: label || "Holiday",
      type: "custom",
    });
    return res.data?.data as HolidayItem;
  },

  // Remove a holiday by its _id (only own store holidays)
  removeHoliday: async (id: string) => {
    const res = await api.delete(`/store/holidays/${id}`);
    return res.data;
  },
};

export interface HolidayItem {
  _id: string;
  date: string;
  date_str: string;
  label: string;
  type: "weekend" | "custom";
  day_name: string;
  is_active: boolean;
  store_id?: string | null;
}
