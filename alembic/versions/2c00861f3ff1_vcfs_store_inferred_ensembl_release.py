"""Add vcf_release column to the vcfs table to store the inferred ENSEMBL
release identifier that follows PyEnsembl and Varcode conventions.

Revision ID: 2c00861f3ff1
Revises:
Create Date: 2015-08-31 17:50:09.263094

"""

# revision identifiers, used by Alembic.
revision = '2c00861f3ff1'
down_revision = None
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('vcfs', sa.Column('vcf_release', sa.Integer))

def downgrade():
    op.drop_column('vcfs', 'vcf_release')
