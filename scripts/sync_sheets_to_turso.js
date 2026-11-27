const { backupAllData } = require('../api/lib/sync');

if (require.main === module) {
  backupAllData()
    .then((stats) => {
      console.log(`\n🎉 Backup Completed in ONLY ${stats.durationSeconds}s!`);
      console.log(`📊 Declarations:    ${stats.declarations}`);
      console.log(`📊 Collections:     ${stats.collections}`);
      console.log(`📊 Expenses:        ${stats.expenses}`);
      console.log(`📊 Payments:        ${stats.payments}`);
      console.log(`📊 Audit Logs:      ${stats.auditLogs}`);
      console.log(`📊 Deleted Archive: ${stats.deletedArchive}\n`);
      process.exit(0);
    })
    .catch(err => {
      console.error("❌ Backup failed:", err);
      process.exit(1);
    });
}

module.exports = { backupAllData };
