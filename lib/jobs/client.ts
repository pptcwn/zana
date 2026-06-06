import { PgBoss } from "pg-boss";
import { z } from "zod";

let bossPromise: Promise<PgBoss> | undefined;

export function getJobBoss() {
  bossPromise ??= (async () => {
    const { PGBOSS_DATABASE_URL } = z.object({
      PGBOSS_DATABASE_URL: z.url(),
    }).parse(process.env);
    const boss = new PgBoss(PGBOSS_DATABASE_URL);
    boss.on("error", (error) => console.error("[jobs] producer error", error));
    await boss.start();
    return boss;
  })();
  return bossPromise;
}
