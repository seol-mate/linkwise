import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다. .env.example을 참고하세요.");
}

export const db = drizzle(neon(databaseUrl), { schema });
