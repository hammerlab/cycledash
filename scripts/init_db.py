"""Script which initializes a database and sets the migration revision number to
head. This is necessary so that Alembic doesn't run old migrations on a newer
database.

Usage:
   python init_db.py
   python init_db.py force

Options:
   force      This skips the prompt for creating the DB, useful for scripting

cf. https://alembic.readthedocs.org/en/rel_0_7/cookbook.html#building-an-up-to-date-database-from-scratch

"""
import os
import sys
from sqlalchemy import create_engine

sys.path.append('')
import schema


DATABASE_URI = os.environ.get('DATABASE_URI')
prompt = """Are you sure you want to initialize the Cycledash database \
in {0}? (y/n): """.format(DATABASE_URI)
if not DATABASE_URI:
    sys.exit('No $DATABASE_URI found; make sure to source your environment file!')
else:
    force = False
    if len(sys.argv) > 1 and sys.argv[1] == 'force':
        force = True
    if not (force or raw_input(prompt) == 'y'):
        sys.exit('Aborting database creation with URI {0}'.format(DATABASE_URI))

# inside of a "create the database" script, first create
# tables:
schema.metadata.create_all(create_engine(DATABASE_URI))

# then, load the Alembic configuration and generate the
# version table, "stamping" it with the most recent rev:
from alembic.config import Config
from alembic import command
alembic_cfg = Config("alembic.ini")
command.stamp(alembic_cfg, "head")

print 'Created Cycledash DB and stamped with most recent migration!'
