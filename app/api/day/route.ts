import { getStore } from "@/lib/data";
import { dayItems } from "@/lib/domain/day";
import { localDate } from "@/lib/time";

// GET /api/day: o dia de hoje numa linha do tempo
export async function GET() {
  const store = getStore();
  const now = new Date();
  const tz = store.timezone();
  const [reminders, tasks, habits, logs] = await Promise.all([
    store.listReminders(), store.listTasks(), store.listHabits(), store.listHabitLogs(),
  ]);
  return Response.json({ today: localDate(now, tz), timezone: tz, items: dayItems({ reminders, tasks, habits, logs, now, tz }) });
}
