FROM node
ENV D=/

WORKDIR $D
COPY . $D 

RUN npm install && \
	mkdir -p /usr/src/repos
EXPOSE 3000

ENTRYPOINT node ci_server.js
