function toDate(value) {
  if (value && typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function countSmsLogsForStudent(db, studentId, start, end) {
  const snapshot = await db.collection("sms_logs")
    .where("studentId", "==", studentId)
    .get();

  return snapshot.docs.reduce((count, document) => {
    const log = document.data() || {};
    const createdAt = toDate(log.createdAt);
    const countsTowardCap = ["sent", "simulated"].includes(log.status)
      && createdAt
      && createdAt >= start
      && createdAt < end;
    return count + Number(Boolean(countsTowardCap));
  }, 0);
}

module.exports = { countSmsLogsForStudent };