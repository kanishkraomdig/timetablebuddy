import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import timetableData from "@/data/timetable.json";

type Session = {
  day: string;
  slotIdx: number;
  subject: string;
  section: string | null;
  room: string | null;
  faculty: string | null;
  raw: string;
};
type Student = { name: string; enrollments: { subject: string; section: string }[] };
type Data = {
  slots: { period: string; time: string }[];
  days: string[];
  sessions: Session[];
  students: Record<string, Student>;
  subjectNames: Record<string, string>;
};
const data = timetableData as unknown as Data;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PGDM T4 — My Timetable" },
      {
        name: "description",
        content:
          "Enter your roll number to see your personal weekly class schedule across all electives and sections.",
      },
      { property: "og:title", content: "PGDM T4 — My Timetable" },
      {
        property: "og:description",
        content: "Personal weekly schedule lookup for PGDM 2025-27 Term 4.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [input, setInput] = useState("");
  const [roll, setRoll] = useState<string | null>(null);

  const student = roll ? data.students[roll] : null;

  const mySessions = useMemo(() => {
    if (!student) return [];
    const enrolled = new Map<string, string>();
    for (const e of student.enrollments) enrolled.set(e.subject, e.section);
    return data.sessions.filter((s) => {
      const sec = enrolled.get(s.subject);
      if (!sec) return false;
      if (sec === "ALL") return true;
      return s.section === sec;
    });
  }, [student]);

  const grid = useMemo(() => {
    const g: (Session | undefined)[][] = data.days.map(() =>
      data.slots.map(() => undefined),
    );
    for (const s of mySessions) {
      const d = data.days.indexOf(s.day);
      if (d >= 0) g[d][s.slotIdx] = s;
    }
    return g;
  }, [mySessions]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim().toUpperCase();
    setRoll(v || null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            PGDM 2025–27 · Term 4
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            My Timetable
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Enter your roll number to see your personalised weekly class
            schedule — built from your section assignments across all elective
            subjects.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="roll" className="block text-sm font-medium">
              Roll number
            </label>
            <input
              id="roll"
              autoFocus
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 25P001"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none ring-ring focus:ring-2"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Show my timetable
          </button>
        </form>

        {roll && !student && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
            No student found with roll number{" "}
            <span className="font-mono font-semibold">{roll}</span>. Please
            check the format (e.g. <span className="font-mono">25P001</span>).
          </div>
        )}

        {student && (
          <section className="mt-8">
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ This timetable is auto-generated — please cross-check with the
              official notice board.
            </p>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{student.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Roll {roll} · {student.enrollments.length} subjects
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              {student.enrollments.map((e) => (
                <li
                  key={e.subject}
                  className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                  title={data.subjectNames[e.subject] ?? e.subject}
                >
                  {e.subject}
                  {e.section !== "ALL" && (
                    <span className="ml-1 text-muted-foreground">
                      · Sec {e.section}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/60 text-left">
                    <th className="w-28 border-b border-border p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Day
                    </th>
                    {data.slots.map((slot) => (
                      <th
                        key={slot.period}
                        className="border-b border-l border-border p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        <div>{slot.period}</div>
                        <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/80">
                          {slot.time}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((day, di) => (
                    <tr key={day} className="align-top">
                      <td className="border-t border-border p-3 font-semibold">
                        {day}
                      </td>
                      {grid[di].map((cell, si) => (
                        <td
                          key={si}
                          className="border-l border-t border-border p-2"
                        >
                          {cell ? (
                            <div className="rounded-md bg-accent/40 p-2">
                              <div
                                className="font-semibold text-foreground"
                                title={
                                  data.subjectNames[cell.subject] ?? cell.subject
                                }
                              >
                                {cell.subject}
                                {cell.section && (
                                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                                    (Sec {cell.section})
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                {cell.room && <span>📍 {cell.room}</span>}
                                {cell.faculty && <span>👤 {cell.faculty}</span>}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full min-h-[2.5rem]" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              This timetable is auto-generated — please cross-check with the
              official notice board for accuracy.
            </p>
          </section>
        )}

        {!roll && (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Try a roll number like{" "}
            <button
              type="button"
              onClick={() => {
                setInput("25P001");
                setRoll("25P001");
              }}
              className="font-mono font-semibold text-primary underline-offset-2 hover:underline"
            >
              25P001
            </button>
            .
          </div>
        )}
      </main>
    </div>
  );
}