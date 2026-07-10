type GitOperation = "none" | "merge" | "rebase" | "cherryPick" | "revert";
type ConflictDecision = "unresolved" | "ours" | "theirs" | "both";
type SideStatus = "modified" | "added" | "deleted";

type WorkspaceSnapshot = {
  cwd: string;
  root: string;
  repoName: string;
  branch: string;
  operation: GitOperation;
  oursLabel: string;
  theirsLabel: string;
  headline: string;
  files: ConflictFileSummary[];
  totalBlocks: number;
};

type ConflictFileSummary = {
  path: string;
  fileName: string;
  directory: string;
  conflictCount: number;
  oursStatus: SideStatus;
  theirsStatus: SideStatus;
  staged: boolean;
};

type ConflictBlock = {
  index: number;
  ours: string;
  theirs: string;
  decision: ConflictDecision;
};
