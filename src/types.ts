// @spokes spoke
// Pure type definitions — zero non-type exports keeps this file at R4's
// zero-export exemption, and zero internal imports keeps it a valid leaf.

export type Role = 'hub' | 'spoke' | 'unmarked';

export interface Loc {
  file: string;
  line: number;
  col: number;
}

export interface Node {
  path: string;
  role: Role;
  exports: string[];
}

export interface Edge {
  from: string;
  to: string;
  locations: Loc[];
}

export interface Graph {
  nodes: Map<string, Node>;
  edges: Edge[];
}

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  message: string;
  primary: Loc;
  related: Loc[];
  severity: Severity;
}

export interface RoleGlob {
  glob: string;
  role: 'hub' | 'spoke';
}

export type SingleExportLevel = 'off' | 'warn' | 'error';
export type TypeOnlyEdges = 'ignore' | 'count';

export interface SpokesConfig {
  include: string[];
  exclude: string[];
  roles: RoleGlob[];
  defaultRole: Role;
  strictCycles: boolean;
  singleExport: SingleExportLevel;
  typeOnlyEdges: TypeOnlyEdges;
  externalPackages: 'ignore';
}

export interface CheckStats {
  nodes: number;
  edges: number;
  hubs: number;
  spokes: number;
  unmarked: number;
}

export interface CheckResult {
  version: 1;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  stats: CheckStats;
}

export interface Cycle {
  members: string[];
  closingEdge: {
    from: string;
    to: string;
    loc: Loc;
  };
}

export interface SuggestFileChange {
  path: string;
  oldLine: string;
  newLine: string;
}

export interface SuggestProposal {
  cycle: Cycle;
  hubPath: string;
  hubStubExports: string[];
  changes: SuggestFileChange[];
}
