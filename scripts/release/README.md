# How to Release CycleDash

A release of [semantic version](http://semver.org/) vX.Y.Z is created in 4
steps:

1. Generate the changelog:
  * `./scripts/changelog.py vX.Y.Z > CHANGELOG.md`
2. Commit the changelog:
  * `git add CHANGELOG.md`
  * `git commit -m "Release vX.Y.Z"`
  * "Release" should be capitalized.
3. Create an annotated tag:
  * `git tag -a vX.Y.Z`
  * The annotation should be a summary of major changes since the previous
    version, culled from `CHANGELOG.md`.
  * It's important to collaborate on release notes in advance of pushing them,
    as there is no pull-request type interface for releases.
4. Push the release commit and the tag to GitHub:
  * `git push origin`
  * The new tag can be pushed with `git push origin vX.Y.Z`.
5. Go to
   [CycleDash's releases page](https://github.com/hammerlab/cycledash/releases)
   on Github and edit the tag, copying the message into the text box there so
   that Markdown will be nicely rendered.
