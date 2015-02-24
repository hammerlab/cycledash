var React = require('react');

var SubmitRunForm = React.createClass({
  render: function() {
    return (
  <form method="POST" action="/runs" role="form" id="submit">
  <h2><button type="button" className="close" aria-hidden="true">&times;</button></h2>
    <div className="form-group">
      <label>Variant Caller Name:</label>
      <input className="form-control" type="text" name="variantCallerName"
             placeholder="Guacamole::Somatic" />
    </div>
    <div className="form-group">
      <label>Dataset Name:</label>
      <input className="form-control" type="text" name="dataset"
             placeholder="DREAM training chr20" />
    </div>
    <div className="form-group">
      <label>Project:</label>
      <input className="form-control" type="text" name="projectName"
             placeholder="PT0123" />
    </div>
    <div className="form-group">
      <label>VCF Path:</label>
      <input className="uploadable form-control" type="text" name="vcfPath"
             placeholder="/data/somevcf.vcf" />
    </div>
    <div className="form-group">
      <label>Truth VCF Path:</label>
      <input className="uploadable form-control" type="text" name="truthVcfPath"
             placeholder="/data/true_somevcf.vcf" />
    </div>
    <br/>
    <h4>Optional <small>all paths should be HDFS paths to canonical data</small></h4>
    <div className="form-group">
      <label>Tumor BAM:</label>
      <input className="form-control" type="text" name="tumorPath"
             placeholder="/data/dream/tumor.chr20.bam" />
    </div>
    <div className="form-group">
      <label>Normal BAM:</label>
      <input className="form-control" type="text" name="normalPath"
             placeholder="/data/dream/normal.chr20.bam" />
    </div>
    <div className="form-group">
      <label>Notes, Config, Params:</label>
      <textarea className="form-control" rows="3" name="params"
                placeholder="command line parameters here"></textarea>
    </div>

    <button type="submit" className="btn btn-success btn-block">Submit New Run</button>
  </form>
  );
  }
});
module.exports = SubmitRunForm;
