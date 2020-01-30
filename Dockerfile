FROM centos
ENV D=/root/

ARG OC_LOC=https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/openshift-client-linux-4.3.0.tar.gz 

WORKDIR $D
COPY . $D 

RUN dnf install git -y && \
    dnf install nodejs -y && \
    curl -SL $OC_LOC |\
    tar -xvz -C /usr/bin --exclude="README.md" && \
    npm install 

EXPOSE 3000

ENTRYPOINT npm start 
