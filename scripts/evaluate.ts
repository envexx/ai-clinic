import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { classifyIntent } from "../src/modules/ai/intent";
import { searchKnowledge } from "../src/modules/knowledge/retrieval";
import { prisma } from "../src/lib/db";

type EvalCase = {
  id: string;
  split: "dev" | "holdout";
  category: "answerable" | "unanswerable" | "booking" | "injection";
  expectedSource?: string;
  input: string;
};

type Tally = { ok: number; total: number };

function rate(tally: Tally): string {
  if (tally.total === 0) return "n/a";
  return `${((tally.ok / tally.total) * 100).toFixed(1)}% (${tally.ok}/${tally.total})`;
}

async function main() {
  const datasetPath = join(process.cwd(), "evals", "knowledge-dataset.json");
  const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as {
    cases: EvalCase[];
  };

  const clinic = await prisma.clinic.findFirstOrThrow();
  const clinicId = clinic.id;

  const answerable: Tally = { ok: 0, total: 0 };
  const abstain: Tally = { ok: 0, total: 0 };
  const booking: Tally = { ok: 0, total: 0 };
  const failures: string[] = [];

  for (const testCase of dataset.cases) {
    if (testCase.category === "answerable") {
      const hits = await searchKnowledge(clinicId, testCase.input, 3);
      const ok = hits.some((hit) => hit.title === testCase.expectedSource);
      answerable.total += 1;
      if (ok) answerable.ok += 1;
      else
        failures.push(
          `${testCase.id} [answerable] got: ${hits.map((h) => h.title).join(", ") || "(none)"}`,
        );
    } else if (
      testCase.category === "unanswerable" ||
      testCase.category === "injection"
    ) {
      const hits = await searchKnowledge(clinicId, testCase.input, 3);
      const ok = hits.length === 0;
      abstain.total += 1;
      if (ok) abstain.ok += 1;
      else failures.push(`${testCase.id} [${testCase.category}] leaked: ${hits.map((h) => h.title).join(", ")}`);
    } else {
      const intent = classifyIntent(testCase.input);
      const ok = intent === "booking" || intent === "appointment_status";
      booking.total += 1;
      if (ok) booking.ok += 1;
      else failures.push(`${testCase.id} [booking] intent=${intent}`);
    }
  }

  console.log("Evaluation report (offline agent + retrieval)");
  console.log(`  answerable grounded : ${rate(answerable)}  (target >= 90%)`);
  console.log(`  abstain rate        : ${rate(abstain)}  (target >= 90%)`);
  console.log(`  booking intent      : ${rate(booking)}`);

  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
  }

  const answerablePass = answerable.total > 0 && answerable.ok / answerable.total >= 0.9;
  const abstainPass = abstain.total > 0 && abstain.ok / abstain.total >= 0.9;

  if (!answerablePass || !abstainPass) {
    console.error(
      "\nQuality gate FAILED: evaluation thresholds not met. Note that without GEMINI_API_KEY the retrieval uses a lexical fallback; semantic embeddings are required to reach the target.",
    );
    process.exitCode = 1;
  } else {
    console.log("\nQuality gate passed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
