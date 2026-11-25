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
  let queriedStudentId;
  const db = {
    collection(name) {
      assert.equal(name, "sms_logs");
      return {
        where(field, operator, value) {
          assert.equal(field, "studentId");
          assert.equal(operator, "==");
          queriedStudentId = value;
          return {
            get: async () => ({
              docs: rows
                .filter(row => row[field] === value)
                .map(data => ({ data: () => data })),
            }),
          };
        },
      };
    },
  };

  const count = await countSmsLogsForStudent(db, "student-a", start, end);

  assert.equal(queriedStudentId, "student-a");
  assert.equal(count, 2);
});

test("returns zero when no student logs exist", async () => {
  const db = {
    collection: () => ({
      where: () => ({ get: async () => ({ docs: [] }) }),
    }),
  };

  assert.equal(await countSmsLogsForStudent(db, "student-a", new Date(0), new Date()), 0);
});