import datetime
from sqlalchemy import *


metadata = MetaData()


Table('users', metadata,
    Column('id', BigInteger, primary_key=True),
    Column('username', String(), unique=True, nullable=False),
    Column('password', String(), nullable=False),
    Column('email', String(), unique=True, nullable=False)
)

Table('projects', metadata,
    Column('id', BigInteger, primary_key=True),
    Column('name', String(), nullable=False, unique=True),
    Column('notes', String())
)

Table('bams', metadata,
    Column('id', BigInteger, primary_key=True),
    Column('project_id', BigInteger, ForeignKey('projects.id'), nullable=False),
    Column('name', String()),
    Column('normal', Boolean, default=False),  # True if the BAM is of normal tissue
    Column('notes', String()),
    Column('tissues', String()),
    Column('resection_date', String()),
    Column('uri', String(), nullable=False)
)

Table('vcfs', metadata,
    Column('id', BigInteger, primary_key=True),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column('tumor_bam_id', BigInteger, ForeignKey('bams.id')),
    Column('normal_bam_id', BigInteger, ForeignKey('bams.id')),
    Column('project_id', BigInteger, ForeignKey('projects.id'), nullable=False),
    Column('caller_name', String()),  # Name of the caller this came from.
    Column('notes', String()),  # Any notes, params, etc the user might add. Ideally in JSON format.
    Column('uri', String()),  # URI of source file, if any
    Column('vcf_header', String()),  # Plaintext header of the VCF
    Column('vcf_release', Integer),  # ENSEMBL compatible release for reference
    Column('extant_columns', String()),  # JSON list of non-null columns in the VCF
    Column('genotype_count', BigInteger),   # number of variants in this VCF
    UniqueConstraint('project_id', 'uri', name='vcfs_project_id_uri_key')
)

Table('user_comments', metadata,
    Column('id', BigInteger, primary_key=True),
    Column('vcf_id', BigInteger, ForeignKey('vcfs.id'), nullable=False),
    Column('sample_name', String()),
    Column('contig', String()),
    Column('position', Integer),
    Column('reference', String()),
    Column('alternates', String()),
    Column('comment_text', String(), nullable=False),
    Column('user_id', BigInteger, ForeignKey('users.id')),
    Column('created', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column('last_modified', DateTime(timezone=True), nullable=False, server_default=func.now())
)

Table('task_states', metadata,
    Column('id', BigInteger, primary_key=True),
    Column('vcf_id', BigInteger, ForeignKey('vcfs.id')),
    Column('type', String()),  # worker name
    Column('task_id', String()),  # Celery task ID
    Column('state', String())  # worker state, e.g. SUCCESS, FAILURE, STARTED, ...
)

Table('genotypes', metadata,
    Column('vcf_id', BigInteger, ForeignKey('vcfs.id'), nullable=False),
    Column('sample_name', String()),
    Column('contig', String()),
    Column('position', Integer),
    Column('id', String()),
    Column('reference', String()),
    Column('alternates', String()),
    Column('filters', String()),
    Column('quality', String()),

    # Cycledash-derived data
    # These are from the varcode annotation worker
    Column('annotations:gene_name', String()),
    Column('annotations:transcript', String()),
    Column('annotations:effect_notation', String()),
    Column('annotations:effect_type', String()),

    # This is the star/flag
    Column('annotations:starred', Boolean, default=False),

    # Many of the below values taken from VCF4.2 spec examples
    # some taken from existing VCFs.
    # INFO columns
    Column('info:AA', String()),  # ancestral allele
    Column('info:AC', String()),  # (array) allele counts in GTs
    Column('info:AF', String()),  # allele freqs in GTs
    Column('info:AN', String()),  # (array) total number of alleles in GTs
    Column('info:BQ', String()),  # RMS base quality
    Column('info:CIGAR', String()),  # cigar string how an ALT aligns with REF
    Column('info:DB', String()),  # [BOOLEAN] dbSNP membership
    Column('info:DP', String()),  # [INTEGER] combined depth across samples
    Column('info:H2', String()),  # [BOOLEAN] membership in hapmap 2
    Column('info:H3', String()),  # [BOOLEAN] membership in hapmap 3
    Column('info:MQ', String()),  # RMS mapping quality
    Column('info:MQ0', String()),  # [INTEGER] number of mapQ == 0 reads covering this record
    Column('info:NS', String()),  # [INTEGER] number of samples with data
    Column('info:SB', String()),  # strand bias at position
    Column('info:SOMATIC', String()),  # record is a somatic mutation
    Column('info:VALIDATED', String()),  # [BOOLEAN] validated by follow-up experiment
    Column('info:1000G', String()),  # [BOOLEAN] membership in 1000 genomes
       # info cols for SVs
    Column('info:IMPRECISE', String()),  # [BOOLEAN] imprecise structural variation
    Column('info:NOVEL', String()),  # [BOOLEAN] a novel SV
    Column('info:END', String()),  # [INTEGER] end position of the variant
    Column('info:SVTYPE', String()),  # type of SV (DEL, INS, DUP, INV, SNV, BND)
    Column('info:SVLEN', String()),  # [INTEGER] difference in length between REF and ALT alleles
    Column('info:CIPOS', String()),  # confidence interval around POS
    Column('info:CIEND', String()),  # confidence interval END
    Column('info:MEINFO', String()),  # mobile element info of the form NAME,START,END,POLARITY
    Column('info:METRANS', String()),  # mobile element transduction info of the form CHR,START,END,POLARITY
    Column('info:DGVID', String()),  # ID of this element in Database of Genomic Variation
    Column('info:DBVARID', String()),  # ID of element in DBVAR
    Column('info:DBRIP', String()),  # ID of element in DBRIP
    Column('info:MATEID', String()),  # ID of mare breakend
    Column('info:PARID', String()),  #  ID of partner breakend
    Column('info:EVENT', String()),  # ID of event associate to breakend
    Column('info:CILEN', String()),  # confidence interval around inserted materail between breakend
    Column('info:DPADJ', String()),  # read depth of adjacency
    Column('info:CN', String()),  # copy number of segment containing breakend
    Column('info:CNADJ', String()),  # copy number of adjacency
    Column('info:CICN', String()),  # []confidence interval around copy number for the segment
    Column('info:CICNADJ', String()),  # [ARRAY<INTEGER>]confidence interval around copy number for the adjacency
    # sample columns:
    Column('sample:GT', String()),  # genotype
    Column('sample:DP', String()),  # [INTEGER] read depth
    Column('sample:FT', String()),  # filter indicating this GT was called (like FILTER field)
    Column('sample:GL', String()),  # genotype likelihood list
    Column('sample:GLE', String()),  # genotype likelihood of het. ploidy
    Column('sample:PL', String()),  # phred-scaled genotype likelihoods
    Column('sample:GP', String()),  # phred-scaled genotype posterior probs
    Column('sample:GQ', String()),  # phred-scaled genotype posterior probs
    Column('sample:HQ', String()),  # haplotype qualities
    Column('sample:PS', String()),  # phase set
    Column('sample:PQ', String()),  # phasing quality
    Column('sample:EC', String()),  # (array) expected alt allele counts
    Column('sample:MQ', String()),  # RMS mapping quality
    # sample cols for SVs
    Column('sample:CN', String()),  # copy number genotype for imprecise events
    Column('sample:CNQ', String()),  # copy number genotype quality for imprecise events
    Column('sample:CNL', String()),  # copy number genotype likeihood for imprecise events
    Column('sample:NQ', String()),  # phred style prob. score that variant is novel
    Column('sample:HAP', String()),  # unique haplotype ID
    Column('sample:AHAP', String()),  # unique ID of ancestral haplotype

    # from LUMPY caller
    Column('info:STR', String()),  #  strand orientation of adjacency in BEDPE format
    Column('info:CIPOS95', String()),  # (array) conf int 95th percentile
    Column('info:EVTYPE', String()),  # type of lumpy evidence
    Column('info:PSUP', String()),  # [INTEGER] # of paired-end reads supporting the variant across all samples
    Column('info:PRIN', String()),  # [BOOLEAN] identifies variant and principle variant in a BEDPE pair
    Column('info:SRSUP', String()),  # [INTEGER] # of split reads supporting the variant across all samples
    Column('info:SUP', String()),  # [INTEGER] # of pieces of evidence supporting the variant across all samples
    Column('sample:PE', String()),  # [INTEGER] number of paired end reads supporting the variant
    Column('sample:SR', String()),  # [INTEGER] number of split reads supporting the variant
    Column('sample:SUP', String()),  # [INTEGER] # of pieces of evidence supporting the variant across all samples

    # from Strelka
    Column('info:QSS', String()),  # [INTEGER] Quality score for any somatic snv, ie. for the ALT allele to be present at a significantly different frequency in the tumor and normal
    Column('info:QSS_NT', String()),  # [INTEGER] Quality score reflecting the joint probability of a somatic variant and NT
    Column('info:SGT', String()),  # Most likely somatic genotype excluding normal noise states
    Column('info:TQSS', String()),  # [INTEGER] Data tier used to compute QSS
    Column('info:TQSS_NT', String()),  # [INTEGER] Data tier used to compute QSS_NT
    Column('info:NT', String()),  # Genotype of the normal in all data tiers, as used to classify somatic variants. One of {ref,het,hom,conflict}
    Column('sample:FDP', String()),  # [INTEGER] Number of basecalls filtered from original read depth for tier1
    Column('sample:SDP', String()),  # [INTEGER] Number of reads with deletions spanning this site at tier1
    Column('sample:SUBDP', String()),  # [INTEGER] Number of reads below tier1 mapping quality threshold aligned across this site
    Column('sample:AU', String()),  # (array) Number of 'A' alleles used in tiers 1,2
    Column('sample:CU', String()),  # (array) Number of 'C' alleles used in tiers 1,2
    Column('sample:GU', String()),  # (array) Number of 'G' alleles used in tiers 1,2
    Column('sample:TU', String()),  # (array) Number of 'T' alleles used in tiers 1,2

    # from Varscan
    Column('info:SS', String()),  # Somatic status of variant (0=Reference,1=Germline,2=Somatic,3=LOH, or 5=Unknown)
    Column('info:SSC', String()),  # Somatic score in Phred scale (0-255) derived from somatic p-value
    Column('info:GPV', String()),  # Fisher's Exact Test P-value of tumor+normal versus no variant for Germline calls
    Column('info:SPV', String()),  # Fisher's Exact Test P-value of tumor versus normal for Somatic/LOH calls
    Column('sample:RD', String()),  # Depth of reference-supporting bases (reads1)
    Column('sample:AD', String()),  # [TEXT] Depth of variant-supporting bases (reads2)
    Column('sample:FREQ', String()),  # Variant allele frequency
    Column('sample:DP4', String()),  # Strand read counts: ref/fwd, ref/rev, var/fwd, var/rev

    # from Somatic Sniper
    Column('sample:IGT', String()),  # Genotype when called independently (only filled if called in joint prior mode)
    Column('sample:BCOUNT', String()),  # (array) Occurrence count for each base at this site (A,C,G,T)
    Column('sample:JGQ', String()),  # Joint genotype quality (only filled if called in join prior mode)
    Column('sample:VAQ', String()),  # Variant allele quality
    Column('sample:AMQ', String()),  # Average mapping quality

    # from Virmid
    Column('info:NDP', String()),  # Read depth in control sample
    Column('info:NAC', String()),  # Allele count in control sample
    Column('info:DDP', String()),  # Read depth in disease sample
    Column('info:DAC', String()),  # Allele count in disease sample

    # from Mutect
    Column('sample:FA', String()),  # (array) Allele fraction of the alternate allele with regard to reference

    # from Hammerlab
    Column('info:ABQ', String()),  # Average base quality
    Column('info:AMQ', String()),  # Average mapping quality
    Column('info:AGQ', String()),  # Average genotype quality
    Column('sample:ABQ', String()),  # Average base quality
    Column('sample:AGQ', String()),  # Average genotype quality

    # other
    Column('info:VAF', String()),  # variant allele frequency
    Column('info:DPR', String())  # avg depth in region
)
