# JSON API

## Authentication

Authentication is done via
[HTTP basic authorization](https://en.wikipedia.org/wiki/Basic_access_authentication),
and is required for all API calls.

### VCFs

JSON should be POSTed to <tt>/api/runs</tt> with following fields:

#### Required

<dl class="dl-horizontal">
  <dt>uri</dt>
  <dd>
    The path on HDFS where the VCF can be found.
    (e.g. <tt>/users/cycledasher/pt-123.vcf</tt>)
    This should be immutable, as CycleDash expects
    to be able to find the VCF here at any time.
  </dd>
  <dt>projectName</dt>
  <dd>
    The name of the project that the run related to.
  </dd>
</dl>

#### Optional

<dl class="dl-horizontal">
  <dt>tumorBamUri</dt>
  <dd>The path on HDFS of the tumor BAM on which the caller was run. The BAM must already be in the database.</dd>
   <dt>tumorBamId</dt>
  <dd>The ID of the BAM.</dd>
   <dt>normalBamUri</dt>
  <dd>The path on HDFS of the normalBAM on which the caller was run. The BAM must already be in the database.</dd>
   <dt>normalBamId</dt>
  <dd>The ID of the BAM.</dd>
   <dt>params</dt>
  <dd>Params that the caller was run with, or other notes relevant to the run.</dd>
   <dt>variantCallerName</dt>
  <dd>
    The name of the variant caller which produced this VCF. This
    should remain constrant between VCFs with the same caller in
    order to compare runs to one another.
  </dd>
</dl>


### Projects

JSON should be POSTed to <tt>/api/projects</tt> with following fields:

#### Required

<dl class="dl-horizontal">
  <dt>name</dt>
  <dd>
    The name of the project. This can be an obfuscated patient ID, or a research project name, etc.
  </dd>
</dl>

#### Optional

<dl class="dl-horizontal">
  <dt>notes</dt>
  <dd>Any pertinent project notes.</dd>
</dl>

### BAMs

JSON should be POSTed to <tt>/api/bams</tt> with following fields:

#### Required

<dl class="dl-horizontal">
  <dt>uri</dt>
  <dd>The URI of the BAM on HDFS. Should start with 'hdfs://'.</dd>
  <dt>projectName (or projectId)</dt>
  <dd>
    The name of the project that the run related to.
  </dd>
</dl>

#### Optional

<dl class="dl-horizontal">
  <dt>name</dt>
  <dd>
    The name of the BAM. This is just for easy identification.
  </dd>
  <dt>notes</dt>
  <dd>Any pertinent BAM notes.</dd>
  <dt>tissues</dt>
  <dd>The resected tissue types.</dd>
  <dt>resection_date</dt>
  <dd>The resected date, in YYYY-MM-DD form.</dd>
</dl>
