[![Build Status](https://travis-ci.org/hammerlab/cycledash.svg?branch=master)](https://travis-ci.org/hammerlab/cycledash) [![Coverage Status](https://img.shields.io/coveralls/hammerlab/cycledash/master.svg)](https://coveralls.io/r/hammerlab/cycledash?branch=master)


# CycleDash

CycleDash tracks runs of somatic variant callers on various (BAM) datasets and
provides an interface with which to inspect, analyze, debug, and improve the
resultant variant calls.

The primary feature of CycleDash is its "Examine Page" (screenshot below), which
allows users to quickly filter, order, and examine variants. A user can use a
SQL-like syntax to filter down to variants based on attributes of the genotype
(e.g. DP or GQ), their position in the genome (e.g. `X:1500000-3000000`), or
other annotations added by CycleDash workers (e.g. the gene a variant falls in).

We embed the [BioDalliance](http://www.biodalliance.org/) pileup viewer within
this page, allowing users to explore the pileup at a variant's location.

![Looking at a VCF on the "Examine Page"](http://cl.ly/image/3k3M321g0H1H/Screen%20Shot%202014-11-24%20at%2012.32.09%20PM.png)


## How We Use CycleDash

At [Hammerlab](https://github.com/hammerlab) we're using CycleDash to help us
improve our distributed somatic variant caller,
[Guacamole](https://github.com/hammerlab/guacamole).

Our workflow is:

1. [Ketrew](https://github.com/hammerlab/ketrew), our workflow engine, starts a
   Guacamole job.
2. When the job is complete, the resulting VCF and metadata is posted via a JSON
   RESTful interface to CycleDash.
3. CycleDash processes the VCFs and presents them in an easy-to-navigate
   interface (found in the screenshot, above).
4. If a validation VCF is posted with the main VCF, CycleDash calculates
   statistics like precision and recall.

CycleDash can also be used by researchers interested in quickly browsing VCFs
for variants of interest.


## Developing CycleDash

CycleDash is a Python [Flask](http://flask.pocoo.org/) app with a
[React.js](http://facebook.github.io/react/) frontend. We use
[PostgreSQL](http://www.postgresql.org/) as our database, and use a worker queue
to execute longer-running tasks such as importing VCFs into Postgres or
annotating variants with gene names.

More information about developing CycleDash can be found in the DEVELOP.md file
in this repository.


## Deploying CycleDash

A barebones deploy of CycleDash might look like following the develop
instructions for getting it up and running. There are better options, though.

We use [unicornherder](https://github.com/gds-operations/unicornherder) with
[gunicorn](http://gunicorn.org/) (so that many server processes may run at once)
under [Upstart](http://upstart.ubuntu.com/) to keep things up and
running. [nginx](http://nginx.org/) acts as a reverse proxy and serves (and
manages cache headers for) our static assets.


## Issues/Features/Bugs

We welcome bug reports and feature requests, and handle them through GitHub's
issue tracker.

Please search our [GitHub issues](https://github.com/hammerlab/cycledash/issues)
before filing an issue. This project is under very active development.


## Basic JSON API

The primary endpoint for posting data to from an external source is `/runs`.

Additional information can be found at `/`, on the running webserver.

JSON should be POSTed to `/runs` with following fields:

**Required**<br />
`vcfPath` -- The path on HDFS where the VCF can be found. This should be immutable, as CycleDash expects to be able to find the VCF here at any time.<br />
`variantCallerName` -- The name of the variant caller which produced this VCF. This should remain constrant between VCFs with the same caller in order to compare runs to one another.<br />

**Optional, highly recommended if truth VCF exists**<br />
`truthVcfPath` -- The path on HDFS for the truth (or "reference") VCF. This should be immutable.<br />

**Optional**<br />
`dataset` -- The name of the dataset on which the caller was run (e.g. Dream Chromosome 20).<br />
`tumorPath` -- The path on HDFS of the tumor BAM on which the caller was run.<br />
`normalPath` -- The path on HDFS of the normalBAM on which the caller was run.<br />
`params` -- Params that the caller was run with, or other notes relevant to the run.<br />
