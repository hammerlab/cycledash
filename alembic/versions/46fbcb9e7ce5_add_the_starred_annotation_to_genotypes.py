"""Add the starred annotation to genotypes

Revision ID: 46fbcb9e7ce5
Revises: 1ab5aa1e3054
Create Date: 2015-10-02 12:28:25.291837

"""

# revision identifiers, used by Alembic.
revision = '46fbcb9e7ce5'
down_revision = '1ab5aa1e3054'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('genotypes', sa.Column('annotations:starred', sa.Boolean, default=False))


def downgrade():
    op.drop_column('genotypes', 'annotations:starred')
