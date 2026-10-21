import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOnboardingQuestions,
  discoverIncomingResume,
  loadOnboardingState,
  onboardingProgress,
  parseResumeText,
  recordOnboardingAnswer,
} from "../src/onboarding.js";

describe("resume onboarding", () => {
  it("extracts conservative contact, section, and technology suggestions", () => {
    const parsed = parseResumeText(`
      Example Candidate
      example.candidate@example.test | +1 555 010 0200
      https://www.example.test/profile

      SUMMARY
      Backend engineer building API services.

      EXPERIENCE
      Example Company | Software Engineer | 2022 - Present
      Built TypeScript and Node.js services.

      EDUCATION
      Example University | B.S. Computer Science

      SKILLS
      TypeScript, Node.js, PostgreSQL, Docker
    `);

    expect(parsed.name).toBe("Example Candidate");
    expect(parsed.email).toBe("example.candidate@example.test");
    expect(parsed.phone).toContain("+1 555 010 0200");
    expect(parsed.urls).toEqual(["https://www.example.test/profile"]);
    expect(parsed.sections.experience).toContain("Example Company");
    expect(parsed.sections.education).toContain("Example University");
    expect(parsed.keywords).toEqual(expect.arrayContaining(["TypeScript", "Node.js", "PostgreSQL", "Docker"]));
  });

  it("always asks for confirmation of material portal facts", () => {
    const questions = buildOnboardingQuestions(parseResumeText("Example Candidate\nexample@example.test\n"));
    const ids = questions.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining([
      "work_authorization",
      "authorization_expiry",
      "professional_experience",
      "compensation",
      "voluntary_demographics",
    ]));
    expect(questions.every((item) => item.answer === null && item.status === "pending")).toBe(true);
  });

  it("makes missing contact details explicit instead of fabricating them", () => {
    const parsed = parseResumeText("A resume without contact fields\n\nEXPERIENCE\nExample work");
    const questions = buildOnboardingQuestions(parsed);

    expect(parsed.email).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
    expect(questions.find((item) => item.id === "contact_email")?.question).toContain("not detected");
    expect(questions.find((item) => item.id === "contact_phone")?.question).toContain("not detected");
  });

  it("finds the single PDF placed in the candidate inbox", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "onboarding-inbox-"));
    const inbox = path.join(root, "candidate", "inbox");
    fs.mkdirSync(inbox, { recursive: true });
    fs.writeFileSync(path.join(inbox, "resume.pdf"), "fixture");

    expect(discoverIncomingResume(root)).toBe(path.join(inbox, "resume.pdf"));
  });

  it("persists each answer and becomes ready when required questions are answered", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "onboarding-answers-"));
    fs.mkdirSync(path.join(root, "candidate"), { recursive: true });
    const questions = buildOnboardingQuestions(parseResumeText("Example Candidate\nexample@example.test"));
    fs.writeFileSync(path.join(root, "candidate", "onboarding.json"), JSON.stringify({
      schemaVersion: 1,
      status: "questions_pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resume: { sourceFileName: "resume.pdf", selectedResume: "candidate/resumes/resume.pdf", resumeProfile: "primary", parsedTextFile: "candidate/parsed-resume.txt" },
      extracted: { urls: [], keywords: [] },
      sections: {},
      questions,
    }), "utf8");
    fs.writeFileSync(path.join(root, "candidate", "onboarding-questions.md"), "", "utf8");

    const first = questions.find((item) => item.requiredForSearch)!;
    const firstProgress = recordOnboardingAnswer(root, first.id, "confirmed answer");
    expect(firstProgress.answered).toBe(1);
    expect(firstProgress.requiredRemaining).toBeGreaterThan(0);
    expect(loadOnboardingState(root)?.questions.find((item) => item.id === first.id)?.answer).toBe("confirmed answer");

    for (const item of questions.filter((candidate) => candidate.requiredForSearch && candidate.id !== first.id)) {
      recordOnboardingAnswer(root, item.id, "confirmed answer");
    }
    const completed = onboardingProgress(loadOnboardingState(root)!);
    expect(completed.status).toBe("ready_for_search");
    expect(completed.requiredRemaining).toBe(0);
  });
});
