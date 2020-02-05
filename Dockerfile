FROM centos
ENV D=/root/

ARG OC_LOC=https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/openshift-client-linux-4.3.0.tar.gz 
ARG OPERATOR_SDK_LOC=https://github.com/operator-framework/operator-sdk/releases/download/v0.12.0/operator-sdk-v0.12.0-x86_64-linux-gnu

WORKDIR $D

RUN dnf install -y nodejs git golang podman buildah slirp4netns

RUN curl -sSL $OC_LOC |\
    tar -xvz -C /usr/bin --exclude="README.md" && \
    curl -sSL $OPERATOR_SDK_LOC -o /usr/bin/operator-sdk &&\
    chmod a+x /usr/bin/operator-sdk

COPY . $D

RUN npm install

RUN echo "nobody:1000000000:999999" >> /etc/subuid &&\
    echo "nobody:1000000000:999999" >> /etc/subgid

EXPOSE 3000 

RUN chown -R nobody:nobody .

USER nobody

ENTRYPOINT npm start 
