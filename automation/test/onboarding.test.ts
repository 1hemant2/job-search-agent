import { describe, expect, it } from "vitest";
import { buildOnboardingQuestions, parseResumeText } from "../src/onboarding.js";

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
});
