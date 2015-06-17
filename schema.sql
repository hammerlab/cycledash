CREATE TABLE projects (
       id BIGSERIAL PRIMARY KEY,
       name TEXT UNIQUE NOT NULL,
       notes TEXT
);

CREATE TABLE bams (
       id BIGSERIAL PRIMARY KEY,
       project_id BIGINT REFERENCES projects NOT NULL,
       name TEXT,
       normal BOOLEAN DEFAULT FALSE, -- true if the bam is of normal tissue
       notes TEXT,
       tissues TEXT,
       resection_date TEXT,
       uri TEXT NOT NULL
);

CREATE TABLE vcfs (
       id BIGSERIAL PRIMARY KEY,
       created_at TIMESTAMP DEFAULT statement_timestamp() NOT NULL,
       tumor_bam_id BIGINT REFERENCES bams,
       normal_bam_id BIGINT REFERENCES bams,
       project_id BIGINT REFERENCES projects NOT NULL,

       caller_name TEXT, -- Name of the caller this came from.
       validation_vcf BOOLEAN DEFAULT false, -- whether or not this is a validation VCF
       notes TEXT, -- Any notes, params, etc the user might add. Ideally in JSON format.
       uri TEXT UNIQUE, -- URI of source file, if any
       vcf_header TEXT, -- Plaintext header of the VCF
       extant_columns TEXT, -- JSON list of non-null columns in the VCF
       genotype_count BIGINT,  -- number of variants in this VCF

       precision NUMERIC,
       recall NUMERIC,
       f1score NUMERIC
);

CREATE TABLE user_comments (
       id BIGSERIAL PRIMARY KEY,
       vcf_id BIGINT REFERENCES vcfs ON DELETE CASCADE NOT NULL,
       sample_name TEXT,
       contig TEXT,
       position INTEGER,
       reference TEXT,
       alternates TEXT,
       comment_text TEXT NOT NULL,
       author_name TEXT,
       created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
       last_modified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_states (
      id BIGSERIAL PRIMARY KEY,
      vcf_id BIGINT REFERENCES vcfs,
      type TEXT,  -- worker name
      task_id TEXT,  -- Celery task ID
      state TEXT  -- worker state, e.g. SUCCESS, FAILURE, STARTED, ...
);

CREATE TABLE genotypes (
       vcf_id BIGINT REFERENCES vcfs ON DELETE CASCADE NOT NULL,
       sample_name TEXT,
       contig TEXT,
       position INTEGER,
       id TEXT,
       reference TEXT,
       alternates TEXT,
       filters TEXT,
       quality TEXT,

       -- Cycledash-derived data
       "annotations:gene_names" TEXT,
       -- These are from the varcode annotation worker
       "annotations:varcode_gene_name" TEXT,
       "annotations:varcode_transcript" TEXT,
       "annotations:varcode_effect_notation" TEXT,
       "annotations:varcode_effect_type" TEXT,

       -- Many of the below values taken from VCF4.2 spec examples
       -- some taken from existing VCFs.
       -- INFO columns
       "info:AA" TEXT, -- ancestral allele
       "info:AC" TEXT, -- (array) allele counts in GTs
       "info:AF" TEXT, -- allele freqs in GTs
       "info:AN" TEXT, -- (array) total number of alleles in GTs
       "info:BQ" TEXT, -- RMS base quality
       "info:CIGAR" TEXT, -- cigar string how an ALT aligns with REF
       "info:DB" TEXT, -- [BOOLEAN] dbSNP membership
       "info:DP" TEXT, -- [INTEGER] combined depth across samples
       "info:H2" TEXT, -- [BOOLEAN] membership in hapmap 2
       "info:H3" TEXT, -- [BOOLEAN] membership in hapmap 3
       "info:MQ" TEXT, -- RMS mapping quality
       "info:MQ0" TEXT, -- [INTEGER] number of mapQ == 0 reads covering this record
       "info:NS" TEXT, -- [INTEGER] number of samples with data
       "info:SB" TEXT, -- strand bias at position
       "info:SOMATIC" TEXT, -- record is a somatic mutation
       "info:VALIDATED" TEXT, -- [BOOLEAN] validated by follow-up experiment
       "info:1000G" TEXT, -- [BOOLEAN] membership in 1000 genomes
       -- info cols for SVs
       "info:IMPRECISE" TEXT, -- [BOOLEAN] imprecise structural variation
       "info:NOVEL" TEXT, -- [BOOLEAN] a novel SV
       "info:END" TEXT, -- [INTEGER] end position of the variant
       "info:SVTYPE" TEXT, -- type of SV (DEL, INS, DUP, INV, SNV, BND)
       "info:SVLEN" TEXT, -- [INTEGER] difference in length between REF and ALT alleles
       "info:CIPOS" TEXT, -- confidence interval around POS
       "info:CIEND" TEXT, -- confidence interval END
       "info:MEINFO" TEXT, -- mobile element info of the form NAME,START,END,POLARITY
       "info:METRANS" TEXT, -- mobile element transduction info of the form CHR,START,END,POLARITY
       "info:DGVID" TEXT, -- ID of this element in Database of Genomic Variation
       "info:DBVARID" TEXT, -- ID of element in DBVAR
       "info:DBRIP" TEXT, -- ID of element in DBRIP
       "info:MATEID" TEXT, -- ID of mare breakend
       "info:PARID" TEXT, --  ID of partner breakend
       "info:EVENT" TEXT, -- ID of event associate to breakend
       "info:CILEN" TEXT, -- confidence interval around inserted materail between breakend
       "info:DPADJ" TEXT, -- read depth of adjacency
       "info:CN" TEXT, -- copy number of segment containing breakend
       "info:CNADJ" TEXT, -- copy number of adjacency
       "info:CICN" TEXT, -- []confidence interval around copy number for the segment
       "info:CICNADJ" TEXT, -- [ARRAY<INTEGER>]confidence interval around copy number for the adjacency
       -- sample columns:
       "sample:GT" TEXT, -- genotype
       "sample:DP" TEXT, -- [INTEGER] read depth
       "sample:FT" TEXT, -- filter indicating this GT was called (like FILTER field)
       "sample:GL" TEXT, -- genotype likelihood list
       "sample:GLE" TEXT, -- genotype likelihood of het. ploidy
       "sample:PL" TEXT, -- phred-scaled genotype likelihoods
       "sample:GP" TEXT, -- phred-scaled genotype posterior probs
       "sample:GQ" TEXT, -- phred-scaled genotype posterior probs
       "sample:HQ" TEXT, -- haplotype qualities
       "sample:PS" TEXT, -- phase set
       "sample:PQ" TEXT, -- phasing quality
       "sample:EC" TEXT, -- (array) expected alt allele counts
       "sample:MQ" TEXT, -- RMS mapping quality
       -- sample cols for SVs
       "sample:CN" TEXT, -- copy number genotype for imprecise events
       "sample:CNQ" TEXT, -- copy number genotype quality for imprecise events
       "sample:CNL" TEXT, -- copy number genotype likeihood for imprecise events
       "sample:NQ" TEXT, -- phred style prob. score that variant is novel
       "sample:HAP" TEXT, -- unique haplotype ID
       "sample:AHAP" TEXT, -- unique ID of ancestral haplotype

       -- from LUMPY caller
       "info:STR" TEXT, --  strand orientation of adjacency in BEDPE format
       "info:CIPOS95" TEXT, -- (array) conf int 95th percentile
       "info:EVTYPE" TEXT, -- type of lumpy evidence
       "info:PSUP" TEXT, -- [INTEGER] # of paired-end reads supporting the variant across all samples
       "info:PRIN" TEXT, -- [BOOLEAN] identifies variant and principle variant in a BEDPE pair
       "info:SRSUP" TEXT, -- [INTEGER] # of split reads supporting the variant across all samples
       "info:SUP" TEXT, -- [INTEGER] # of pieces of evidence supporting the variant across all samples
       "sample:PE" TEXT, -- [INTEGER] number of paired end reads supporting the variant
       "sample:SR" TEXT, -- [INTEGER] number of split reads supporting the variant
       "sample:SUP" TEXT, -- [INTEGER] # of pieces of evidence supporting the variant across all samples

       -- from Strelka
       "info:QSS" TEXT, -- [INTEGER] Quality score for any somatic snv, ie. for the ALT allele to be present at a significantly different frequency in the tumor and normal
       "info:QSS_NT" TEXT, -- [INTEGER] Quality score reflecting the joint probability of a somatic variant and NT
       "info:SGT" TEXT, -- Most likely somatic genotype excluding normal noise states
       "info:TQSS" TEXT, -- [INTEGER] Data tier used to compute QSS
       "info:TQSS_NT" TEXT, -- [INTEGER] Data tier used to compute QSS_NT
       "info:NT" TEXT, -- Genotype of the normal in all data tiers, as used to classify somatic variants. One of {ref,het,hom,conflict}
       "sample:FDP" TEXT, -- [INTEGER] Number of basecalls filtered from original read depth for tier1
       "sample:SDP" TEXT, -- [INTEGER] Number of reads with deletions spanning this site at tier1
       "sample:SUBDP" TEXT, -- [INTEGER] Number of reads below tier1 mapping quality threshold aligned across this site
       "sample:AU" TEXT, -- (array) Number of 'A' alleles used in tiers 1,2
       "sample:CU" TEXT, -- (array) Number of 'C' alleles used in tiers 1,2
       "sample:GU" TEXT, -- (array) Number of 'G' alleles used in tiers 1,2
       "sample:TU" TEXT, -- (array) Number of 'T' alleles used in tiers 1,2

       -- from Varscan
       "info:SS" TEXT, -- Somatic status of variant (0=Reference,1=Germline,2=Somatic,3=LOH, or 5=Unknown)
       "info:SSC" TEXT, -- Somatic score in Phred scale (0-255) derived from somatic p-value
       "info:GPV" TEXT, -- Fisher's Exact Test P-value of tumor+normal versus no variant for Germline calls
       "info:SPV" TEXT, -- Fisher's Exact Test P-value of tumor versus normal for Somatic/LOH calls
       "sample:RD" TEXT, -- Depth of reference-supporting bases (reads1)
       "sample:AD" TEXT, -- [TEXT] Depth of variant-supporting bases (reads2)
       "sample:FREQ" TEXT, -- Variant allele frequency
       "sample:DP4" TEXT, -- Strand read counts: ref/fwd, ref/rev, var/fwd, var/rev

       -- from Somatic Sniper
       "sample:IGT" TEXT, -- Genotype when called independently (only filled if called in joint prior mode)
       "sample:BCOUNT" TEXT, -- (array) Occurrence count for each base at this site (A,C,G,T)
       "sample:JGQ" TEXT, -- Joint genotype quality (only filled if called in join prior mode)
       "sample:VAQ" TEXT, -- Variant allele quality
       "sample:AMQ" TEXT, -- Average mapping quality

       -- from Virmid
       "info:NDP" TEXT, -- Read depth in control sample
       "info:NAC" TEXT, -- Allele count in control sample
       "info:DDP" TEXT, -- Read depth in disease sample
       "info:DAC" TEXT, -- Allele count in disease sample

       -- from Mutect
       "sample:FA" TEXT, -- (array) Allele fraction of the alternate allele with regard to reference

       -- from Hammerlab
       "info:ABQ" TEXT, -- Average base quality
       "info:AMQ" TEXT, -- Average mapping quality
       "info:AGQ" TEXT, -- Average genotype quality
       "sample:ABQ" TEXT, -- Average base quality
       "sample:AGQ" TEXT, -- Average genotype quality

       -- other
       "info:VAF" TEXT, -- variant allele frequency
       "info:DPR" TEXT -- avg depth in region
);
