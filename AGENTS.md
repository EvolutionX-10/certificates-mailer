# Agent instructions

## Git commit identity

For every commit in this repository, always use:

- Name: `EvolutionX-10`
- Email: `85353424+EvolutionX-10@users.noreply.github.com`

Use this identity for both author and committer. Before creating a commit, check
`git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT`; correct any mismatch
with repository-local Git configuration. Do not rely on an inherited identity.
Do not add another author or co-author unless the user explicitly requests it.
