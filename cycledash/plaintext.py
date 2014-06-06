HOME_TEXT = """
~~~~~~~~~~~~~~~~~~~~~~~~~
| Welcome to CycleDash. |
~~~~~~~~~~~~~~~~~~~~~~~~~

We use JSON. Recommend using httpie[1] to interface with this from the CLI.

To get a JSON response, be sure to accept application/json. This can be done
with the --json flag in httpie.

You may be looking for...

POST    /runs                       -- submit a new run to cycledash
                                       c.f. /docs/format (json or form encoded)
GET     /runs                       -- list all runs
GET     /runs/<run_id>              -- return a particular run
GET     /runs/compare/<run_id>(,<run_id>)*   -- display concordance of given
                                                runs (html only)  [TODO]
GET     /callers                    -- list all callers and latest scores
GET     /callers/<caller_name>      -- display runs for and a graph of scores
                                       for runs of a given caller

-------- __@      __@       __@       __@      __~@
----- _`\<,_    _`\<,_    _`\<,_     _`\<,_    _`\<,_
---- (*)/ (*)  (*)/ (*)  (*)/ (*)  (*)/ (*)  (*)/ (*)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

[1]: http://httpie.org
"""


FORMAT_TEXT = """
POST to /runs a JSON object of the format below:

    {
      "variantCallerName": "name of the variant caller",
      "sha1": "hash of git commit for this run",
      "dataset": "name of the dataset used for this run, e.g. dream.training.chr20",
      "f1score": 0.xxx,
      "precision": 0.xxx,
      "recall": 0.xxx,
    }

NOTE: Be careful that 'name' is constant between submissions for the same
caller, otherwise data will not be aggregated correctly.
"""
