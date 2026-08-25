import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { promisify } from "node:util";
import { DATA_FILE } from "@/render/paths";
import type { PageData } from "@/types/page";

const run = promisify(execFile);

/**
 * generatedAt은 실행할 때마다 바뀌므로 변경 판단에서 제외한다.
 * 그렇지 않으면 데이터가 그대로여도 매 실행마다 커밋이 쌓인다.
 */
function contentKey(data: PageData): string {
  const { generatedAt: _ignored, ...rest } = data;
  return JSON.stringify(rest);
}

async function readExisting(): Promise<PageData | null> {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf-8")) as PageData;
  } catch {
    return null;
  }
}

/** data/latest.json을 갱신한다. 내용이 실제로 바뀐 경우에만 쓰고 true를 반환. */
export async function writeDataFile(data: PageData): Promise<boolean> {
  const previous = await readExisting();
  if (previous && contentKey(previous) === contentKey(data)) return false;

  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
  return true;
}

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: process.cwd() });
  return stdout.trim();
}

/** data/latest.json을 커밋하고 origin에 푸시한다 (GitHub Actions 배포 트리거) */
export async function commitAndPush(message: string): Promise<void> {
  const path = relative(process.cwd(), DATA_FILE);

  await git("add", path);

  const staged = await git("diff", "--cached", "--name-only");
  if (!staged) {
    console.log("[publish] 커밋할 변경 없음");
    return;
  }

  await git("commit", "-m", message);

  // 다른 머신에서 먼저 푸시했을 수 있으므로 rebase 후 푸시한다.
  await git("pull", "--rebase", "--autostash");
  await git("push");

  console.log(`[publish] 푸시 완료 — ${message}`);
}

/** 데이터를 파일로 쓰고, 변경이 있으면 커밋·푸시까지 한다. */
export async function publishData(data: PageData): Promise<void> {
  const changed = await writeDataFile(data);
  if (!changed) {
    console.log("[publish] 데이터 변동 없음 — 커밋 생략");
    return;
  }

  const counts = data.apartments.map((a) => `${a.name} 매물 ${a.summary.activeCount}건`).join(", ");

  await commitAndPush(`data: ${counts}`);
}
