---
name: github-action-monitor
description: Monitors GitHub Action workflows in the background after pushing code. Trigger this skill whenever you push code to GitHub and need to verify the CI/CD pipeline succeeds.
---

# GitHub Action Monitor Skill

You are responsible for ensuring that code pushed to GitHub passes all automated checks and deployments via GitHub Actions.

## Instructions

Whenever you push code to the repository (e.g., `git push origin main`):
1. Do not just assume the push succeeded in the CI/CD pipeline.
2. Immediately after the push completes, you MUST monitor the GitHub Action run.
3. Use the `run_command` tool to execute `gh run watch` in the repository directory. This command automatically finds the most recent workflow run and waits for it to complete.
4. Because CI/CD pipelines can take several minutes, the `gh run watch` command will automatically run as a background task. **DO NOT poll the task status manually in a loop.** Simply stop calling tools and end your turn. The system will automatically wake you up and notify you when the command completes.
5. Once you receive the system notification about the task completion:
   - If the command succeeded (exit code 0), inform the user that the CI/CD pipeline and deployment passed successfully.
   - If the command failed (non-zero exit code), use `gh run view --log` to analyze the failure, determine what broke the build/deployment, and propose a fix to the user.

## Requirements
- This skill assumes the GitHub CLI (`gh`) is installed and authenticated.
