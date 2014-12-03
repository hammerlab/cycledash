#!/usr/bin/env python
"""Prints the changelog.

This is a markdown-formatted list of all merged pull requests,
with their descriptions and links back to GitHub, e.g.

# CycleDash
## Version vX.Y.Z
* Issue #[1](http://github.com/hammerlab/cycledash/pull/19): `Pull Request Description`
...
"""
import re
import subprocess
import sys


GITHUB_PR_URL = 'http://github.com/hammerlab/cycledash/pull/{}'


def get_commits():
    gitlog = subprocess.check_output(['git', 'log', '--decorate'])
    lines = gitlog.split('\n')

    commits = []
    commit_lines = []
    for line in lines:
        if commit_lines and line[:6] == 'commit':
            commit = make_commit(commit_lines)
            commits.append(commit)
            commit_lines = []
        if line:
            commit_lines.append(line)

    if commit_lines:
        commit = make_commit(commit_lines)
        commits.append(commit)

    return commits


def extract_search(r, text):
    """Return first matched group's text, if any, else None."""
    match = re.search(r, text, flags=re.I)
    res = None
    if match:
        groups = match.groups()
        if groups:
            res = groups[0]
    return res


def extract_first(r, lines, index=False):
    """Return the first matched group's text in lines of text, else None.

    If index is True, return (line_index_match_found_on, text).
    """
    extractions = (extract_search(r, line) for line in lines)
    match, match_idx = None, None
    for idx, e in enumerate(extractions):
        if e:
            match = e
            match_idx = idx
            break
    if index:
        return match_idx, match
    return match


def make_commit(lines):
    title_index, title = extract_first(r'^\s+(.*)$', lines, index=True)
    desc = (lines[title_index + 2].strip()
            if title_index and len(lines) > title_index + 2 else None)
    commit = {
        'title': title.strip(),
        'description': desc,
        'commit': extract_first(r'commit (\w)', lines),
        'tag': extract_first(r'tag: (.*?)(,|\))', lines)
    }
    return commit


def pr_number_from_title(title):
    return extract_search('merge pull request #([0-9]+)', title)


def generate_changelog(commits, version):
    print "# CycleDash Changelog"
    print "## Version {}".format(version)
    for commit in commits:
        title = commit['title']
        if 'Release' in title:
            continue
        tag = commit['tag']
        desc = commit['description']
        if title is None:
            continue
        if tag:
            print "## Version {}".format(tag)
        if 'merge pull request' in title.lower():
            pr = pr_number_from_title(title)
            if pr:
                pr_url = GITHUB_PR_URL.format(pr)
                print "* PR #[{}]({}): \"{}\"".format(pr, pr_url, desc)


if __name__ == '__main__':
    if sys.argv[1:]:
        version = sys.argv[1]
    else:
        sys.exit('version required!\n  e.g. changelog.py vX.Y.Z')
    commits = get_commits()
    generate_changelog(commits, version)
