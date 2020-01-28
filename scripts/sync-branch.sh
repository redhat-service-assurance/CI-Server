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
echo "Trying to update repo branch!"

if git show-ref --verify --quiet "$REF"; then
    echo "Creating new branch $BRANCH"
    git checkout --track origin/"$BRANCH"
    git pull
else 
    echo "Updating existing branch $BRANCH"
    git checkout "$BRANCH"
    git pull
fi

