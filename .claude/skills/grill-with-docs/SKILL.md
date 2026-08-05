---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go. Asks the whole decision frontier per round for fast iteration.
disable-model-invocation: true
---

Interview the user relentlessly until you reach a shared understanding, using the `/domain-modeling` skill to write docs (glossary + ADRs) as you go.

**语言：** 访谈对话与产出的所有文档（CONTEXT.md、ADR）一律使用简体中文；代码、标识符、专有名词保留原文。

## 提问策略（batch）

Map the design as a **design tree**: every decision branches into the decisions that hang off it. Work the tree in **rounds**:

- The **frontier** is every decision whose prerequisites are already settled — the questions you can ask _now_ without guessing at answers you haven't heard yet.
- Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.
- Each round's answers reshape the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.
- A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.
- Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it — don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report — ask the rest of the frontier now. The _decisions_ are the user's — put each to them and wait.

## 落档（domain-modeling）

After **each round's answers** come back, immediately write down what crystallised — do not wait until the end:

- A term crystallised → write/update it in `CONTEXT.md`.
- A decision settled → write it as an ADR under `docs/adr/000N-<slug>.md`.
- Create lazily: no `CONTEXT.md` yet → create it when the first term resolves; no `docs/adr/` yet → create it when the first ADR is needed.

## 轮间校验

Open each round by checking the previous round's answers against what's already in the glossary: "词汇表把 X 定义为 A，你的回答暗示 B——哪个？" A conflict goes in as the first numbered question of this round. (A conflict can never be caught in the same round that produced it — it surfaces one round later; that is the accepted cost of batching.)

## 结束

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
