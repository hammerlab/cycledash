#!/bin/bash
set -o errexit

# If we're not in a virtual environment and haven't passed "force" to the
# script, then make sure the user wants to run the upgrade.
if [[ (! $VIRTUAL_ENV)  && (! $1 || (! ($1 -neq 'force'))) ]]; then
    read 'You are not running in a virtual environment, are you sure you would like to proceed? ' -n 1 -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo 'Aborting upgrade.'
        exit 1
    fi
fi

echo Upgrading Cycledash
echo
echo Pulling from origin/master...
git pull origin master

echo Installing and upgrading dependencies...
source ENV.sh
pip install -r requirements.txt
npm install

echo Building assets...
gulp prod

echo Migrating the database...
alembic upgrade head

echo Done upgrading Cycledash.
echo Restart workers and the Cycledash server to finish your upgrade.
