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
  attachmentPath: string;
  attachmentHash: string;
  sourceLink: string | null;
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
source_link: ${input.sourceLink === null ? "null" : yamlString(input.sourceLink)}
artifact_path: ${yamlString(input.attachmentPath)}
artifact_hash: ${yamlString(input.attachmentHash)}
captured: ${input.captured}
status: processed
---

# ${input.title}

${input.attachmentLink}

## Summary


## Next actions

`;
}
