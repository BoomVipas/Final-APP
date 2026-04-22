# Agent Teams — Master Reference Guide

> Source: https://code.claude.com/docs/en/agent-teams
> Requires: Claude Code v2.1.32+
> Status: Experimental (disabled by default)

---

## Table of Contents

1. [Quick Start Checklist](#1-quick-start-checklist)
2. [Core Concepts](#2-core-concepts)
3. [Agent Teams vs Subagents — Decision Matrix](#3-agent-teams-vs-subagents--decision-matrix)
4. [Enabling Agent Teams](#4-enabling-agent-teams)
5. [Architecture Reference](#5-architecture-reference)
6. [Display Modes](#6-display-modes)
7. [Team Control & Commands](#7-team-control--commands)
8. [Task Management](#8-task-management)
9. [Communication Patterns](#9-communication-patterns)
10. [Hooks for Quality Gates](#10-hooks-for-quality-gates)
11. [Permissions](#11-permissions)
12. [Token Cost Awareness](#12-token-cost-awareness)
13. [Best Practice Rules](#13-best-practice-rules)
14. [Proven Prompt Templates](#14-proven-prompt-templates)
15. [Troubleshooting Playbook](#15-troubleshooting-playbook)
16. [Known Limitations](#16-known-limitations)
17. [Subagent Reference (for comparison)](#17-subagent-reference-for-comparison)

---

## 1. Quick Start Checklist

- [ ] Claude Code v2.1.32+ installed (`claude --version`)
- [ ] Enable via `settings.json` or env var (see §4)
- [ ] Install tmux or iTerm2 if you want split-pane mode
- [ ] Start with 3–5 teammates on a research/review task
- [ ] Always clean up via the **lead** when done

---

## 2. Core Concepts

| Concept | Description |
|:--------|:------------|
| **Team Lead** | The main Claude Code session that creates and coordinates the team |
| **Teammate** | An independent Claude Code instance with its own context window |
| **Task List** | Shared list of work items teammates claim and complete |
| **Mailbox** | Messaging system for direct agent-to-agent communication |
| **Spawn** | The act of the lead creating a new teammate session |

**Key mental model:** The lead is a coordinator, not a worker. Teammates own the work. The lead synthesizes and delegates.

---

## 3. Agent Teams vs Subagents — Decision Matrix

| Factor | Use Subagents | Use Agent Teams |
|:-------|:-------------|:----------------|
| Workers need to talk to each other | No | **Yes** |
| Tasks are sequential | **Yes** | No |
| Same file edits | **Yes** | No |
| Results just need to return to main | **Yes** | No |
| Parallel independent modules | Optional | **Yes** |
| Debate / competing hypotheses | No | **Yes** |
| Cross-layer (frontend + backend + tests) | Optional | **Yes** |
| Token budget is tight | **Yes** | No |
| Quick, focused workers | **Yes** | No |

**Rule of thumb:** If teammates need to challenge each other's findings or coordinate autonomously → Agent Teams. Otherwise → Subagents.

---

## 4. Enabling Agent Teams

**Option A — settings.json (recommended, persists across sessions):**
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**Option B — Shell environment:**
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

---

## 5. Architecture Reference

```
Team Lead (main session)
    │
    ├── Task List (shared, file-locked)
    │       └── task-001, task-002, task-003 ...
    │
    ├── Mailbox (auto-delivery, no polling needed)
    │
    ├── Teammate A ──────────┐
    ├── Teammate B ──────────┤ (direct messaging between any pair)
    └── Teammate C ──────────┘
```

**Storage locations:**
- Team config: `~/.claude/teams/{team-name}/config.json`
- Task list: `~/.claude/tasks/{team-name}/`
- Team config contains a `members` array with each teammate's name, agent ID, and agent type

**Context loading on spawn:** Each teammate loads the same project context as a regular session:
- `CLAUDE.md` files
- MCP servers
- Skills
- Spawn prompt from the lead
- **Does NOT inherit the lead's conversation history**

---

## 6. Display Modes

| Mode | How it works | Setup required |
|:-----|:-------------|:---------------|
| `in-process` (default if no tmux) | All teammates in one terminal; cycle with `Shift+Down` | None |
| `tmux` / split panes | Each teammate in its own pane | tmux or iTerm2 + it2 CLI |
| `auto` | Uses split panes if already in tmux, otherwise in-process | — |

**Configure in settings.json:**
```json
{
  "teammateMode": "in-process"
}
```

**Override per session:**
```bash
claude --teammate-mode in-process
```

**Install tmux:**
```bash
# macOS
brew install tmux
# Or use iTerm2 with: tmux -CC
```

**Keyboard shortcuts (in-process mode):**
- `Shift+Down` — cycle through teammates
- `Enter` — view a teammate's session
- `Escape` — interrupt current turn
- `Ctrl+T` — toggle task list

---

## 7. Team Control & Commands

All control is natural language directed at the lead.

### Spawn with specific roles and models
```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

### Require plan approval before implementation
```
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```
- Teammate stays in read-only plan mode until lead approves
- Lead can approve or reject with feedback
- You can influence the lead: "only approve plans that include test coverage"

### Talk to a specific teammate
- In-process: `Shift+Down` to navigate, then type
- Split-pane: click the pane

### Shut down a teammate gracefully
```
Ask the researcher teammate to shut down
```

### Clean up the entire team
```
Clean up the team
```
**Warning:** Always run cleanup from the **lead**, not a teammate. Shut down all active teammates first.

### Keep the lead from working instead of delegating
```
Wait for your teammates to complete their tasks before proceeding
```

---

## 8. Task Management

**Task states:** pending → in progress → completed

**Dependency system:** A task with unresolved dependencies cannot be claimed until those dependencies complete. Resolution is automatic.

**How tasks get claimed:**
- Lead assigns explicitly: "Give task X to teammate Y"
- Self-claim: teammate picks up the next unassigned, unblocked task automatically

**File locking:** Task claiming uses file locking to prevent race conditions.

**Stuck tasks:** If a task appears stuck, manually verify if the work is done and update status or tell the lead to nudge the teammate.

**Optimal ratio:** 5–6 tasks per teammate.

---

## 9. Communication Patterns

### Lead ↔ Teammate
- Teammates auto-notify the lead when they go idle
- Lead sends task assignments and shutdown requests

### Teammate ↔ Teammate (direct)
- `message`: send to one specific teammate
- `broadcast`: send to all teammates simultaneously — **use sparingly**, costs scale with team size

### Information the lead needs to pass at spawn
Teammates do not inherit conversation history. Always include in the spawn prompt:
- Relevant file paths
- Constraints or rules
- Context about the broader goal
- Any information from earlier in the conversation

---

## 10. Hooks for Quality Gates

### TeammateIdle Hook
Fires when a teammate finishes its turn and is about to go idle.

**Input fields:** `teammate_name`, `team_name`, `session_id`, `cwd`, `permission_mode`

**Control:**
- Exit code `2` → teammate receives stderr as feedback and keeps working
- JSON `{"continue": false, "stopReason": "..."}` → stops the teammate entirely

**Example — require build artifact before idle:**
```bash
#!/bin/bash
if [ ! -f "./dist/output.js" ]; then
  echo "Build artifact missing. Run the build before stopping." >&2
  exit 2
fi
exit 0
```

**Configure in settings.json:**
```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "hooks": [
          { "type": "command", "command": "./scripts/check-idle.sh" }
        ]
      }
    ]
  }
}
```

---

### TaskCompleted Hook
Fires when a task is being marked as completed (via TaskUpdate tool or when a teammate finishes its turn with in-progress tasks).

**Input fields:** `task_id`, `task_subject`, `task_description`, `teammate_name`, `team_name`

**Control:**
- Exit code `2` → task is NOT marked complete; stderr fed back to model
- JSON `{"continue": false, "stopReason": "..."}` → stops teammate entirely

**Example — require passing tests before task closes:**
```bash
#!/bin/bash
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

if ! npm test 2>&1; then
  echo "Tests not passing. Fix failing tests before completing: $TASK_SUBJECT" >&2
  exit 2
fi
exit 0
```

| Hook | When | Exit 2 effect |
|:-----|:-----|:--------------|
| `TeammateIdle` | Teammate about to go idle | Teammate keeps working |
| `TaskCompleted` | Task being marked done | Task stays open, feedback sent to model |

---

## 11. Permissions

- Teammates start with the **lead's permission settings**
- If lead uses `--dangerously-skip-permissions`, all teammates do too
- You can change individual teammate modes **after** spawning
- You cannot set per-teammate modes at spawn time
- Permission prompts bubble up to the lead — pre-approve common ops before spawning to reduce friction

---

## 12. Token Cost Awareness

- Each teammate = independent context window = independent token usage
- Token usage scales **linearly** with team size
- Broadcast messages multiply cost by team size
- Best ROI: research, review, new independent features
- Worst ROI: sequential tasks, single-file edits, highly dependent work

**Guidelines:**
- Start with 3–5 teammates
- 5–6 tasks per teammate
- Scale up only when parallelism adds clear value

---

## 13. Best Practice Rules

### Team design
1. **Give teammates enough context at spawn** — they don't inherit the lead's history
2. **Size teams at 3–5** for most workflows
3. **Size tasks to produce a clear deliverable** — one function, one test file, one review domain
4. **Break work so each teammate owns different files** — two teammates editing the same file causes overwrites
5. **Start with research/review tasks** before attempting parallel implementation

### Communication
6. **Use broadcast sparingly** — it multiplies token costs
7. **Include task-specific details in spawn prompts**, not just "review the repo"
8. **Pre-approve permissions before spawning** to avoid friction

### Execution
9. **Monitor and steer** — don't let teams run unattended for too long
10. **Always clean up via the lead** — never via a teammate
11. **Shut down all teammates before cleanup**
12. **If the lead starts working instead of delegating, tell it to wait**

### Quality
13. **Use TeammateIdle and TaskCompleted hooks** for automated quality gates
14. **Use plan approval** for risky or complex implementation tasks
15. **Use CLAUDE.md** to provide project-wide context to all teammates automatically

---

## 14. Proven Prompt Templates

### Parallel Code Review
```
Create an agent team to review PR #[NUMBER]. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

### Competing Hypotheses Debug
```
Users report [SYMPTOM]. Spawn 5 agent teammates to investigate different hypotheses.
Have them talk to each other to try to disprove each other's theories, like a
scientific debate. Update the findings doc with whatever consensus emerges.
```

### Multi-Angle Exploration
```
I'm designing [THING]. Create an agent team to explore this from different angles:
one teammate on UX, one on technical architecture, one playing devil's advocate.
```

### Parallel Module Implementation
```
Create a team with [N] teammates to implement these modules in parallel.
Each teammate should own a separate set of files. Use Sonnet for each teammate.
[List modules and file ownership per teammate]
```

### Spawn with Plan Approval Gate
```
Spawn an [ROLE] teammate to [TASK].
Require plan approval before they make any changes.
Only approve plans that include [CRITERIA].
```

---

## 15. Troubleshooting Playbook

| Symptom | Fix |
|:--------|:----|
| Teammates not appearing | Press `Shift+Down` — they may be running. Or task wasn't complex enough to warrant a team |
| Split panes not working | Check `which tmux`; verify iTerm2 Python API is enabled |
| Too many permission prompts | Pre-approve operations in permission settings before spawning |
| Teammate stopped on error | Use `Shift+Down` to check output; give direct instructions or spawn replacement |
| Lead shuts down before work is done | Tell the lead to keep going |
| Lead doing work instead of delegating | "Wait for your teammates to complete their tasks before proceeding" |
| Task appears stuck | Check if work is actually done; manually update status or nudge via lead |
| Orphaned tmux session | `tmux ls` then `tmux kill-session -t <session-name>` |
| After `/resume`, lead messages missing teammates | Spawn new teammates; in-process teammates don't survive session resumption |

---

## 16. Known Limitations

| Limitation | Details |
|:-----------|:--------|
| No session resumption for in-process teammates | `/resume` and `/rewind` don't restore them |
| Task status can lag | Teammates sometimes fail to mark tasks complete; may block dependents |
| Slow shutdown | Teammates finish current request/tool call before shutting down |
| One team per session | Clean up before starting a new one |
| No nested teams | Teammates cannot spawn their own teams or teammates |
| Fixed lead | Cannot promote a teammate or transfer leadership |
| Permissions set at spawn | Can change modes after spawning but not configure per-teammate at spawn |
| Split panes limited | Not supported in VS Code integrated terminal, Windows Terminal, or Ghostty |

---

## 17. Subagent Reference (for comparison)

Subagents are the lighter-weight alternative. Key differences:

| | Subagents | Agent Teams |
|:-|:---------|:------------|
| Communication | Results return to main only | Direct teammate-to-teammate messaging |
| Context | Own context, results summarized back | Fully independent context per agent |
| Coordination | Main agent manages all work | Shared task list, self-coordinating |
| Token cost | Lower | Higher (scales linearly) |
| Setup | Define `.md` file in `.claude/agents/` | Natural language, no config file needed |
| Best for | Focused tasks, context isolation | Collaborative, debate-driven, parallel implementation |

### When to use subagents instead
- Isolate high-volume operations (test output, log processing)
- Chain sequential steps with handoffs
- Route to cheaper/faster models (Haiku)
- Enforce strict tool restrictions
- Context window protection (keep verbose output out of main context)

### Subagent file structure
```markdown
---
name: agent-name
description: When Claude should use this agent (be specific)
tools: Read, Grep, Glob, Bash
model: sonnet
permissionMode: default
memory: project
---

System prompt here. Be detailed about workflow, checklist, output format.
```

### Built-in subagents
| Agent | Model | Purpose |
|:------|:------|:--------|
| Explore | Haiku | Read-only codebase search |
| Plan | Inherits | Read-only research for plan mode |
| general-purpose | Inherits | Complex multi-step tasks with all tools |

---

*Last updated: 2026-03-24 | Source: https://code.claude.com/docs/en/agent-teams*
