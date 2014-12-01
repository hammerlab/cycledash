See the [development instructions](/DEVELOP.md) to learn how to develop
CycleDash.

Sending a pull request will run various tests on Travis-CI. You can save
yourself some hassle by running these yourself before sending a PR:

    ./scripts/travis-test.sh

This will run lint checks in addition to Python and JavaScript tests.

We mostly adhere to the Google style guides for [JavaScript][1] and
[Python][2], with a few exceptions (e.g. four character indents in Python).
Your pull request will go more smoothly if you follow these guides as well.

You should also check for changes to the screenshot tests by running:

    dpxdt update tests/pdifftests

If there are changes, these should be included in your pull request. It's
possible that you'll see changes as a result of capturing screenshots on a
different OS, or different OS version, rather than because of real changes. In
this case, it's fine to ignore the differences.

CycleDash is licensed under the Apache 2.0 license. Your code is assumed to be
as well.

[1]: https://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml
[2]: https://google-styleguide.googlecode.com/svn/trunk/pyguide.html
