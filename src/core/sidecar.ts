import type { ParaKind } from "../types";

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export interface SidecarInput {
  title: string;
  artifact: string;
  para: ParaKind;
  projectNote: string | null;
  captured: string;
  sourceNote: string;
  attachmentLink: string;
}

export function buildSidecar(input: SidecarInput): string {
  const projectLine = input.projectNote
    ? `project: ${yamlString(`[[${input.projectNote.replace(/\.md$/i, "")}]]`)}\n`
    : "";
  return `---
type: handwriting
source_app: Goodnotes
artifact_kind: ${yamlString(input.artifact.toLowerCase())}
para: ${input.para}
${projectLine}source_note: ${yamlString(`[[${input.sourceNote.replace(/\.md$/i, "")}]]`)}
captured: ${input.captured}
status: processed
---

# ${input.title}

${input.attachmentLink}

## Summary


## Next actions

`;
}
