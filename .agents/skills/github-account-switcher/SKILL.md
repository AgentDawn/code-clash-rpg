---
name: github-account-switcher
description: Checks the current GitHub CLI account and switches it to AgentDawn if it is not currently AgentDawn. Trigger this when a git push fails with permission issues or when the user asks to switch GitHub accounts.
---

# GitHub Account Switcher Skill

You are responsible for ensuring the active GitHub CLI (`gh`) account is `AgentDawn`.

## Instructions

When invoked or when encountering GitHub permission (403) issues:
1. Run `gh auth status` using the `run_command` tool to check the currently active account.
2. Parse the output to determine the active account.
3. If the active account is ALREADY `AgentDawn`, do nothing and inform the user.
4. If the active account is NOT `AgentDawn`, attempt to switch the account using `gh auth switch -u AgentDawn`.
5. Run `gh auth status` again to verify the switch was successful.
6. If `gh auth switch` fails (e.g., because `AgentDawn` is not authenticated at all on this machine), inform the user that they must manually run `gh auth login` in their terminal to authenticate as AgentDawn, since interactive web-based authentication cannot be fully automated.
7. Finally, after successfully switching, re-attempt the previous `git push` or failed operation if applicable.
