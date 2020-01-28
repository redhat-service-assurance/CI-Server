#!/bin/sh

while getopts p:r:b: option
do
case "${option}"
in
p) REPO_PATH=${OPTARG};;
r) REF=${OPTARG};;
b) BRANCH=${OPTARG};;
esac
done

cd "$REPO_PATH"
echo "[git sync]"
if [ "$(git branch | grep $BRANCH)" ]
then
    echo "Updating existing branch $BRANCH"
    git checkout "$BRANCH"
    git pull
else 
    echo "Creating new branch $BRANCH"
    git checkout --track origin/"$BRANCH"
    git merge HEAD 
fi
echo "[git sync complete]"
echo 

