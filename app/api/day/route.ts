import { getStore } from "@/lib/data";
import { dayItems, nextItem } from "@/lib/domain/day";
import { localDate } from "@/lib/time";

// GET /api/day: o dia de hoje numa linha do tempo
export async function GET() {
  const store = await getStore();
  const now = new Date();
  const tz = store.timezone();
  const [reminders, tasks, habits, logs, events] = await Promise.all([
    store.listReminders(), store.listTasks(), store.listHabits(), store.listHabitLogs(), store.listEvents(),
  ]);
  const items = dayItems({ reminders, tasks, habits, logs, events, now, tz });
  return Response.json({ today: localDate(now, tz), timezone: tz, items, next: nextItem(items, now, tz) });
}
