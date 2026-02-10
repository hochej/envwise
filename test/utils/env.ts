import { parseEnvAssignmentLine } from "../../src/env-assignment";

export interface EnvAssignment {
  name: string;
  value: string;
  lineNumber: number;
}

export function extractEnvAssignments(content: string): EnvAssignment[] {
  const pairs: EnvAssignment[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const assignment = parseEnvAssignmentLine(line);
    if (!assignment || !assignment.value) {
      return;
    }

    pairs.push({
      name: assignment.name,
      value: assignment.value,
      lineNumber: index + 1,
    });
  });

  return pairs;
}
