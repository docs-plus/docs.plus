#!/bin/bash
args=("$@")
echo "Checking Credentials before starting backup"
: ${args[0]:?"Need to set PGHOST non-empty?"}
: ${args[1]:?"Need to set PGPORT non-empty?"}
: ${args[2]:?"Need to set PGDATABASE non-empty?"}
: ${args[3]:?"Need to set PGUSER non-empty?"}
: ${args[4]:?"Need to set PGPASSWORD non-empty?"}

mkdir backup_dump
dump_command="pg_dump -j 12 -Fd -f backup_dump ${args} '${args[2]}' --verbose" 
echo "Starting ${dump_command}"
eval $dump_command
backup_folder=`ls backup_dump/ | wc -l`
if [[ backup_folder -gt 0 ]]; then
  echo "PGDUMP Complete"
else
  echo "PGDUMP failed"
  exit -1
fi

#now=`date +%d-%m-%Y-%H-%M-%S`
zipped_filename="backup.tar.gz"
tar -zcvf $zipped_filename  backup_dump/
rm -rf backup_dump/

