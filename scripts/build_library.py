#!/usr/bin/env python3
"""Build the installable library from the sources in src/.

Sources (edit these):
  src/agents/<agent>.md                      one agent (Claude Code format); `skills:` lists its skills
  src/skills/<skill>/SKILL.md, EXAMPLES.md   one skill: tagged rules and examples

Generated (do not edit by hand, run this script instead):
  .claude/agents/<agent>.md                  Claude Code agent that preloads its playbook
  .claude/skills/<agent>-playbook/           SKILL.md (role, objective, criteria, every rule)
                                             + references/<skill>.md (the skill's EXAMPLES.md)
  .github/agents/<agent>.agent.md            GitHub Copilot agent that links to its playbook
  .github/skills/<agent>-playbook/           the same playbook, for Copilot

Why playbooks: tools cap or budget the number of skills (Cowork loads at most 100 per folder),
so each agent ships as one skill that bundles all of its skills.

Usage:
  python3 scripts/build_library.py           regenerate the four generated folders
  python3 scripts/build_library.py --check   exit 1 if they are out of date (for CI or before a commit)
Standard library only, Python 3.8+.
"""
import argparse
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_AGENTS = os.path.join("src", "agents")
SRC_SKILLS = os.path.join("src", "skills")
OUTPUT_DIRS = [".claude/agents", ".claude/skills", ".github/agents", ".github/skills"]

OBJ_RE = re.compile(
    r"Before producing (.+?), apply the rules of every skill listed in Capabilities "
    r"\(`(?:\.claude|src)/skills/<skill>/SKILL\.md`\) as binding, and use `EXAMPLES\.md` as "
    r"(?:the style reference|a reference)\.")
REF_LINE = "- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices."
COPILOT_TOOLS = {"Read": "read", "Write": "edit", "Edit": "edit", "Glob": "search", "Grep": "search", "Bash": "execute"}
# Claude Code tool names that appear in a few agent objectives, and their tool-neutral wording
# (used for Copilot agents and for playbooks, which are shared by every tool).
TOOL_PHRASES = [
    ("with Read, Glob, and Grep", "by reading and searching the codebase"),
    ("it uses Write exclusively to save the report and Bash only for non-destructive analysis commands (",
     "it edits files exclusively to save the report and runs terminal commands only for non-destructive analysis ("),
    ("verified with Read:", "verified by reading the source code:"),
    (" with Bash (", " in the terminal ("),
    (" with Bash.", " in the terminal."),
]
TOOL_NAME_RE = re.compile(r"\b(Glob|Grep|Bash)\b|\bwith (Read|Write|Edit)\b")

errors = []


def err(msg):
    errors.append(msg)


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read().replace("\r\n", "\n")


def split_frontmatter(text, where):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        err(f"{where}: missing frontmatter")
        return "", text
    return m.group(1), m.group(2)


def fm_value(fm, key, where):
    m = re.search(rf'^{key}:\s*"?(.*?)"?\s*$', fm, re.M)
    if not m:
        err(f"{where}: missing '{key}'")
        return ""
    return m.group(1)


def neutralize(text):
    for old, new in TOOL_PHRASES:
        text = text.replace(old, new)
    return text


def copilot_tools(tools):
    out = []
    for t in (x.strip() for x in tools.split(",")):
        mapped = COPILOT_TOOLS.get(t)
        if mapped is None:
            err(f"unknown tool '{t}'")
        elif mapped not in out:
            out.append(mapped)
    return "[" + ", ".join(f"'{t}'" for t in out) + "]"


def link_capabilities(body, link_for):
    """Turns '- skill' lines of the Capabilities block into Markdown links."""
    def repl(block):
        return re.sub(r"^- ([\w-]+)$", lambda m: f"- [{m.group(1)}]({link_for(m.group(1))})", block.group(0), flags=re.M)
    return re.sub(r"^# Capabilities:\n(?:- .+\n)+", repl, body, flags=re.M)


# ---------------------------------------------------------------- sources
def load_skills():
    skills = {}
    for name in sorted(os.listdir(os.path.join(ROOT, SRC_SKILLS))):
        where = f"{SRC_SKILLS}/{name}"
        if not os.path.isfile(os.path.join(ROOT, where, "SKILL.md")):
            err(f"{where}: missing SKILL.md")
            continue
        fm, body = split_frontmatter(read(f"{where}/SKILL.md"), where)
        desc = fm_value(fm, "description", where)
        if fm_value(fm, "name", where) != name:
            err(f"{where}: name does not match the folder")
        if not desc or len(desc) > 1024 or '"' in desc:
            err(f"{where}: description is empty, longer than 1024 characters, or has inner quotes")
        title = re.search(r"^# Skill: (.+)$", body, re.M)
        rules = [l for l in body.split("\n") if l.startswith("- **[")]
        if not title:
            err(f"{where}: missing '# Skill:' title")
        if not rules or rules[-1] != REF_LINE:
            err(f"{where}: the last rule is not the standard [REFERENCE] line")
        if not os.path.isfile(os.path.join(ROOT, where, "EXAMPLES.md")):
            err(f"{where}: missing EXAMPLES.md")
            continue
        skills[name] = {"name": name, "description": desc, "title": title.group(1).strip() if title else name,
                        "rules": rules[:-1], "examples": read(f"{where}/EXAMPLES.md")}
    return skills


def load_agents(skills):
    agents = {}
    for f in sorted(os.listdir(os.path.join(ROOT, SRC_AGENTS))):
        if not f.endswith(".md"):
            continue
        where = f"{SRC_AGENTS}/{f}"
        fm, body = split_frontmatter(read(where), where)
        name = fm_value(fm, "name", where)
        if name != f[:-3]:
            err(f"{where}: name does not match the file name")
        desc = fm_value(fm, "description", where)
        if not desc or '"' in desc:
            err(f"{where}: description is empty or has inner quotes")
        topics = re.findall(r"^\s+- (\S+)\s*$", fm.split("skills:", 1)[1], re.M) if "skills:" in fm else []
        role = re.search(r"^# Role: (.+)$", body, re.M)
        caps = re.search(r"^# Capabilities:\n((?:- .+\n)+)", body, re.M)
        obj = re.search(r"^# Objective: (.+)$", body, re.M)
        crit = re.search(r"^Acceptance Criteria:\n((?:- .+\n?)+)", body, re.M)
        if not (role and caps and obj and crit):
            err(f"{where}: body needs '# Role:', '# Capabilities:', '# Objective:' and 'Acceptance Criteria:'")
            continue
        if re.findall(r"^- (\S+)$", caps.group(1), re.M) != topics:
            err(f"{where}: Capabilities do not match the skills: list")
        for t in topics:
            if t not in skills:
                err(f"{where}: unknown skill '{t}'")
        if len(OBJ_RE.findall(obj.group(1))) != 1:
            err(f"{where}: Objective must contain the standard 'Before producing ..., apply the rules of every "
                f"skill listed in Capabilities (...)' sentence exactly once")
            continue
        agents[name] = {"name": name, "description": desc, "tools": fm_value(fm, "tools", where), "topics": topics,
                        "body": body, "role": role.group(1).strip(), "objective": obj.group(1).strip(),
                        "criteria": crit.group(1).strip()}
    used = {t for a in agents.values() for t in a["topics"]}
    for s in sorted(set(skills) - used):
        err(f"{SRC_SKILLS}/{s}: not used by any agent")
    return agents


# ---------------------------------------------------------------- outputs
def playbook_description(agent):
    desc = agent["description"]
    m = re.search(r"Delegate (.+)$", desc)
    if m:
        rest = m.group(1)
        if rest.startswith("to it to "):
            use = "Use it to " + rest[len("to it to "):]
        elif re.match(r"(before|after|on|when|during|for) ", rest):
            use = "Use it " + rest
        else:
            use = "Use it for " + re.sub(r" to it\.$", ".", rest)
        desc = desc[:m.start()] + use
    out = (f"Playbook of the {agent['name']} agent (role, rules, acceptance criteria, examples), "
           f"usable with or without the agent. {desc}")
    if len(out) > 1024:
        err(f"{agent['name']}: playbook description is longer than 1024 characters")
    return out


def build(skills, agents):
    files = {}
    for a in agents.values():
        name, pb = a["name"], f"{a['name']}-playbook"
        what = OBJ_RE.search(a["objective"]).group(1)

        # Claude Code agent: same body, preloads the playbook.
        claude_body = OBJ_RE.sub(
            f"Before producing {what}, apply every rule of the preloaded playbook (`.claude/skills/{pb}/SKILL.md`), "
            f"whose sections match the Capabilities above, as binding, and use the examples in its `references/` "
            f"folder as the style reference.", a["body"])
        files[f".claude/agents/{name}.md"] = (
            f"---\nname: {name}\ndescription: \"{a['description']}\"\ntools: {a['tools']}\n"
            f"skills:\n  - {pb}\n---\n{claude_body.rstrip()}\n")

        # GitHub Copilot agent: tool-neutral body, Capabilities link to the playbook.
        copilot_body = OBJ_RE.sub(
            f"Before producing {what}, apply every rule of the playbook (`.github/skills/{pb}/SKILL.md`, linked in "
            f"Capabilities), whose sections match the Capabilities above, as binding, and use the examples in its "
            f"`references/` folder as the style reference.", a["body"])
        copilot_body = neutralize(link_capabilities(copilot_body, lambda t: f"../skills/{pb}/SKILL.md"))
        if TOOL_NAME_RE.search(copilot_body):
            err(f"{name}: Claude Code tool names left in the Copilot agent; extend TOOL_PHRASES")
        files[f".github/agents/{name}.agent.md"] = (
            f"---\nname: {name}\ndescription: \"{a['description']}\"\ntools: {copilot_tools(a['tools'])}\n"
            f"---\n{copilot_body.rstrip()}\n")

        # Playbook: shared by Claude Code, Copilot, and Cowork, so the wording is tool-neutral.
        objective = neutralize(OBJ_RE.sub(
            f"Before producing {what}, apply every rule in the Rules section below as binding, and use the "
            f"examples in `references/` as the style reference.", a["objective"]))
        parts = [
            f"---\nname: {pb}\ndescription: \"{playbook_description(a)}\"\n---\n",
            f"# Playbook: {name}\n",
            f"This playbook holds everything the `{name}` agent applies. When you use it without the agent, "
            f"work as the role below, apply every rule as binding, and check the result against the acceptance "
            f"criteria before you finish.\n",
            f"## Role\n\n{neutralize(a['role'])}\n",
            f"## Objective\n\n{objective}\n",
            f"## Acceptance Criteria\n\n{neutralize(a['criteria'])}\n",
            "## Rules\n\nOne section per topic. Each section ends with a pointer to its examples in `references/`.\n",
        ]
        for i, t in enumerate(a["topics"], 1):
            s = skills[t]
            parts.append(
                f"### {i}. {s['title']} (`{t}`)\n\n*Scope:* {s['description']}\n\n" + "\n".join(s["rules"])
                + f"\n- **[REFERENCE]** See `references/{t}.md` for reference anti-patterns and best practices.\n")
            for tool in (".claude", ".github"):
                files[f"{tool}/skills/{pb}/references/{t}.md"] = s["examples"]
        skill_md = "\n".join(parts)
        if TOOL_NAME_RE.search(skill_md.split("## Rules", 1)[0]):
            err(f"{pb}: Claude Code tool names left in the playbook; extend TOOL_PHRASES")
        if skill_md.count("\n") > 500:
            err(f"{pb}: SKILL.md is longer than 500 lines")
        for tool in (".claude", ".github"):
            files[f"{tool}/skills/{pb}/SKILL.md"] = skill_md
    return files


def on_disk():
    found = {}
    for d in OUTPUT_DIRS:
        base = os.path.join(ROOT, d)
        for dirpath, _, names in os.walk(base):
            for n in names:
                rel = os.path.relpath(os.path.join(dirpath, n), ROOT).replace(os.sep, "/")
                found[rel] = read(rel)
    return found


def main():
    ap = argparse.ArgumentParser(description="Build .claude/ and .github/ from src/.")
    ap.add_argument("--check", action="store_true", help="only check that the generated folders are up to date")
    args = ap.parse_args()

    skills = load_skills()
    agents = load_agents(skills)
    files = build(skills, agents) if not errors else {}
    if errors:
        print("Source errors:\n  " + "\n  ".join(errors), file=sys.stderr)
        return 1

    if args.check:
        disk = on_disk()
        stale = sorted(p for p in files if disk.get(p) != files[p])
        extra = sorted(set(disk) - set(files))
        if stale or extra:
            for p in stale:
                print(f"out of date: {p}")
            for p in extra:
                print(f"not generated: {p}")
            print("Run: python3 scripts/build_library.py", file=sys.stderr)
            return 1
        print(f"Up to date: {len(agents)} agents, {len(agents)} playbooks from {len(skills)} skills.")
        return 0

    for d in OUTPUT_DIRS:
        if os.path.isdir(os.path.join(ROOT, d)):
            shutil.rmtree(os.path.join(ROOT, d))
    for rel, text in sorted(files.items()):
        path = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    print(f"Built {len(agents)} agents and {len(agents)} playbooks from {len(skills)} skills "
          f"({len(files)} files in {', '.join(OUTPUT_DIRS)}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
