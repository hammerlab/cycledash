"""Adds user_id column to the user_comments and drops the author_name column.
This allows us to associate comments with users in the database.

Revision ID: 1ab5aa1e3054
Revises: 2c00861f3ff1
Create Date: 2015-09-01 18:05:35.598253

"""

# revision identifiers, used by Alembic.
revision = '1ab5aa1e3054'
down_revision = '2c00861f3ff1'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.drop_column('user_comments', 'author_name')
    op.add_column('user_comments',
                  sa.Column('user_id',
                            sa.BigInteger,
                            sa.ForeignKey('users.id')))

def downgrade():
    op.drop_column('user_comments', 'user_id')
    op.add_column('user_comments', sa.Column('author_name', sa.String()),)
