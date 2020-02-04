#!/bin/sh

while getopts p:r:b:o:t: option
do
case "${option}"
in
p) REPO_PATH=${OPTARG};;
r) REF=${OPTARG};;
b) BRANCH=${OPTARG};;
o) ORIGIN=${OPTARG};;
t) TOKEN=${OPTARG};;
esac
done

echo 
echo
echo "[git sync]"
echo "Using upstream $ORIGIN"
echo $REPO_PATH

if [ ! -d "$REPO_PATH" ]
then
    echo "Creating new repository from $ORIGIN"
    mkdir "$REPO_PATH"
    cd "/var/tmp/"
    git clone "https://$TOKEN@$ORIGIN"
fi

cd "$REPO_PATH"

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

