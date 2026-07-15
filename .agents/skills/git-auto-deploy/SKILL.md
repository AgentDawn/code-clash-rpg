---
name: git-auto-deploy
description: Automatically handles staging, committing, and pushing code, and ensures CI/CD monitoring follows immediately after. Trigger this skill whenever a feature, bug fix, or task is fully verified locally, or when the user asks to wrap up the work.
---

# Git Auto Deploy Skill

You are responsible for ensuring that finished, verified code is safely and promptly shipped to the remote repository.

## Instructions

Whenever you successfully complete a task (e.g., implementing a feature, writing tests, or fixing a bug) and have verified it works locally:
1. **Never forget to deploy**: Do not wait for the user to explicitly ask "Are you going to deploy?". Proactively initiate the deployment process.
2. **Check Account**: First, quickly trigger the `github-account-switcher` skill to ensure the active GitHub account is correct (AgentDawn).
3. **Check .gitignore**: Ensure that any temporary files, local databases (like `db.sqlite`), or test reports (`playwright-report`) are ignored and won't be pushed.
4. **Commit**: Use `run_command` to execute `git add .` and `git commit -m "[Conventional Commit Message]"`. Make sure the commit message clearly describes what was done (e.g., `feat: Add E2E test scenarios`, `fix: Resolve stat point logic`).
5. **Push**: Use `run_command` to execute `git push origin main` (or the respective branch).
6. **Monitor**: Immediately after a successful push, you MUST trigger the `github-action-monitor` skill to watch the CI/CD pipeline and report the final deployment status to the user.

By following this skill, you guarantee that all local work seamlessly transitions to the live production environment without manual prompting from the user.
