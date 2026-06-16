import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
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
  const tableRef = useRef<HTMLDivElement>(null);

  const student = roll ? data.students[roll] : null;

  const downloadSubjectRollList = () => {
    const targetRolls = [
      "25P007",
      "25P109",
      "25P171",
      "25P233",
      "25P260",
      "25P325",
    ];
    const sectionToRolls = new Map<string, string[]>();
    for (const r of targetRolls) {
      const s = data.students[r];
      if (!s) continue;
      for (const e of s.enrollments) {
        const key = `${e.subject}|${e.section}`;
        if (!sectionToRolls.has(key)) sectionToRolls.set(key, []);
        sectionToRolls.get(key)!.push(r);
      }
    }
    const rows = ["Subject Name,Section,Roll No Found"];
    const keys = Array.from(sectionToRolls.keys()).sort();
    for (const key of keys) {
      const [subject, section] = key.split("|");
      const name = data.subjectNames[subject] ?? subject;
      const sectionLabel = section === "ALL" ? "ALL" : `Sec ${section}`;
      rows.push(`"${subject} - ${name}","${sectionLabel}","${sectionToRolls.get(key)!.join(" / ")}"`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subject-section-rolls.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTimetableImage = async () => {
    if (!tableRef.current || !student) return;
    const dataUrl = await toPng(tableRef.current, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `timetable-${roll}.png`;
    a.click();
  };

  const downloadICS = () => {
    if (!student) return;
    // Parse "8:30-10:00 AM" / "12:00-1:30 PM" → [start24, end24]
    const parseTime = (t: string): [string, string] => {
      const m = t.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return ["090000", "100000"];
      let sh = +m[1], sm = +m[2], eh = +m[3], em = +m[4];
      const pm = m[5].toUpperCase() === "PM";
      // End uses meridiem
      if (pm && eh !== 12) eh += 12;
      if (!pm && eh === 12) eh = 0;
      // Start: assume same meridiem; if start hour > end hour numerically, flip
      let spm = pm;
      if (sh > +m[3]) spm = !pm;
      if (spm && sh !== 12) sh += 12;
      if (!spm && sh === 12) sh = 0;
      const pad = (n: number) => String(n).padStart(2, "0");
      return [`${pad(sh)}${pad(sm)}00`, `${pad(eh)}${pad(em)}00`];
    };

    const dayMap: Record<string, { js: number; by: string }> = {
      Monday: { js: 1, by: "MO" },
      Tuesday: { js: 2, by: "TU" },
      Wednesday: { js: 3, by: "WE" },
      Thursday: { js: 4, by: "TH" },
      Friday: { js: 5, by: "FR" },
      Saturday: { js: 6, by: "SA" },
    };

    // Start from today (16 Jun 2026)
    const start = new Date(2026, 5, 16); // Jun=5, Tue
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PGDM T4//Timetable//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Kolkata",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0530",
      "TZOFFSETTO:+0530",
      "TZNAME:IST",
      "END:STANDARD",
      "END:VTIMEZONE",
    ];

    const dtstamp =
      new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const esc = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

    mySessions.forEach((s, idx) => {
      const dm = dayMap[s.day];
      if (!dm) return;
      const slot = data.slots[s.slotIdx];
      if (!slot) return;
      const [stime, etime] = parseTime(slot.time);
      // first occurrence on/after start matching weekday
      const first = new Date(start);
      while (first.getDay() !== dm.js) first.setDate(first.getDate() + 1);
      const dateStr = fmtDate(first);
      const subjectName = data.subjectNames[s.subject] ?? s.subject;
      const summary = `${s.subject}${s.section ? ` (Sec ${s.section})` : ""} — ${subjectName}`;
      const desc = [s.faculty ? `Faculty: ${s.faculty}` : "", `Raw: ${s.raw}`]
        .filter(Boolean).join("\\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${roll}-${idx}-${dateStr}@pgdm-timetable`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=Asia/Kolkata:${dateStr}T${stime}`,
        `DTEND;TZID=Asia/Kolkata:${dateStr}T${etime}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${dm.by};UNTIL=20260831T235959Z`,
        `SUMMARY:${esc(summary)}`,
        s.room ? `LOCATION:${esc(s.room)}` : "",
        desc ? `DESCRIPTION:${desc}` : "",
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");

    const ics = lines.filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable-${roll}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mySessions = useMemo(() => {
    if (!student) return [];
    const enrolled = new Map<string, string>();
    for (const e of student.enrollments) enrolled.set(e.subject, e.section);
    return data.sessions.filter((s) => {
      const sec = enrolled.get(s.subject);
      if (!sec) return false;
      if (sec === "ALL") return true;
      // Session has no section in TT → single class for everyone enrolled
      if (!s.section) return true;
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
          <button
            type="button"
            onClick={downloadSubjectRollList}
            className="rounded-md border border-border bg-secondary px-5 py-2 text-sm font-semibold text-secondary-foreground transition hover:opacity-90"
          >
            Download subject roll list
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