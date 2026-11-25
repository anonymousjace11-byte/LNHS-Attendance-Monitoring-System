const assert = require("node:assert/strict");
const test = require("node:test");
const { countSmsLogsForStudent } = require("./smsRuntime");

test("counts only today's sent and simulated logs for the requested student", async () => {
  const start = new Date("2026-11-25T00:00:00+08:00");
  const end = new Date("2026-11-26T00:00:00+08:00");
  const rows = [
    { studentId: "student-a", status: "sent", createdAt: start },
    { studentId: "student-a", status: "simulated", createdAt: { toDate: () => new Date("2026-11-25T12:00:00+08:00") } },
    { studentId: "student-a", status: "failed", createdAt: start },
    { studentId: "student-a", status: "sent", createdAt: end },
    { studentId: "student-b", status: "sent", createdAt: start },
  ];
  const filters = [];
  const query = {
    where(field, operator, value) {
      filters.push({ field, operator, value });
      return query;
    },
    async get() {
      return {
        docs: rows
          .filter(row => {
            const createdAt = row.createdAt?.toDate ? row.createdAt.toDate() : row.createdAt;
            return createdAt >= start && createdAt < end;
          })
          .map(data => ({ data: () => data })),
      };
    },
  };
  const db = {
    collection(name) {
      assert.equal(name, "sms_logs");
      return query;
    },
  };

  const count = await countSmsLogsForStudent(db, "student-a", start, end);

  assert.deepEqual(filters, [
    { field: "createdAt", operator: ">=", value: start },
    { field: "createdAt", operator: "<", value: end },
  ]);
  assert.equal(count, 2);
});

test("returns zero when no student logs exist", async () => {
  const query = {
    where: () => query,
    get: async () => ({ docs: [] }),
  };
  const db = {
    collection: () => query,
  };

  assert.equal(await countSmsLogsForStudent(db, "student-a", new Date(0), new Date()), 0);
});