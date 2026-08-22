export type SearchProfileId = "node_backend" | "java_backend";

export const NODE_BACKEND_RESUME = "resumes/Hemant_Kumar_NodeJS_Resume.pdf";
export const JAVA_BACKEND_RESUME = "resumes/Hemant_Kumar_Java_Resume.pdf";

export interface SearchProfileConfig {
  id: SearchProfileId;
  aliases: string[];
  resume: string;
  queryVariants: Array<[query: string, queryVariant: string]>;
  locations: string[];
}

const NODE_QUERY_VARIANTS: Array<[string, string]> = [
  ["Node.js Backend Engineer", "nodejs-backend-engineer"],
  ["Backend Engineer", "backend-engineer"],
  ["Software Engineer Backend", "software-engineer-backend"],
  ["Node.js Developer", "nodejs-developer"],
  ["TypeScript Backend Engineer", "typescript-backend-engineer"],
  ["API Engineer", "api-engineer"],
  ["Platform Engineer", "platform-engineer"],
  ["Distributed Systems Engineer", "distributed-systems-engineer"],
  ["Software Engineer I", "software-engineer-i"],
  ["SDE 1", "sde-1"],
  ["Software Engineer II", "software-engineer-ii"],
  ["SDE 2", "sde-2"],
  ["Java Backend Engineer", "java-backend-engineer"],
];

const JAVA_QUERY_VARIANTS: Array<[string, string]> = [
  ["Backend Engineer Java Spring Boot", "backend-engineer-java-spring-boot"],
  ["Backend Developer Java Spring Boot", "backend-developer-java-spring-boot"],
  ["Software Engineer Java Backend", "software-engineer-java-backend"],
  ["Software Development Engineer Java Backend", "software-development-engineer-java-backend"],
  ["SDE-1 Java Backend", "sde-1-java-backend"],
  ["SDE-2 Java Backend", "sde-2-java-backend"],
  ["Java Backend Engineer", "java-backend-engineer"],
  ["Java Software Engineer", "java-software-engineer"],
  ["Backend Software Engineer Java", "backend-software-engineer-java"],
];

export const SEARCH_PROFILES: Record<SearchProfileId, SearchProfileConfig> = {
  node_backend: {
    id: "node_backend",
    aliases: ["node", "nodejs", "node-backend", "default"],
    resume: NODE_BACKEND_RESUME,
    queryVariants: NODE_QUERY_VARIANTS,
    locations: ["India"],
  },
  java_backend: {
    id: "java_backend",
    aliases: ["java", "java-backend", "spring", "spring-boot"],
    resume: JAVA_BACKEND_RESUME,
    queryVariants: JAVA_QUERY_VARIANTS,
    locations: ["Bengaluru", "Remote India", "Hyderabad", "Pune", "Gurgaon NCR", "India"],
  },
};

export function searchProfileFromToken(token: string | undefined): SearchProfileId | undefined {
  if (!token) return undefined;
  const normalized = token.trim().toLowerCase();
  return (Object.values(SEARCH_PROFILES).find((profile) => profile.aliases.includes(normalized))?.id);
}

/**
 * Resume selection is semantic. A Java-profile run is not enough by itself:
 * Java must be meaningful to the backend role, and a clearly Node.js-specific
 * role keeps the Node.js resume even when Java is merely mentioned.
 */
export function selectResumeForJob(input: {
  role: string;
  description?: string;
  searchProfile?: SearchProfileId;
}): string {
  const role = input.role.toLowerCase();
  const description = (input.description ?? "").toLowerCase();
  const text = `${role}\n${description}`;
  const nodeTitle = /\b(node(?:\.js|js)?|typescript)\b/.test(role);
  const javaTitle = /\bjava\b|\bspring(?: boot)?\b/.test(role);
  const springSignal = /\bspring(?: boot| data| security)?\b|\bhibernate\b|\bjpa\b/.test(text);
  const meaningfulJava = javaTitle
    || springSignal
    || /\bjava\b.{0,35}\b(required|preferred|experience|backend|must|core)\b/.test(text)
    || /\b(required|preferred|experience|must|core)\b.{0,35}\bjava\b/.test(text);

  if (nodeTitle && !javaTitle && !springSignal) return NODE_BACKEND_RESUME;
  if (meaningfulJava) return JAVA_BACKEND_RESUME;
  return NODE_BACKEND_RESUME;
}
