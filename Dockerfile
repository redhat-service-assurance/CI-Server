FROM node
ENV D=/home/

WORKDIR $D
COPY . $D 

RUN npm install

EXPOSE 3000

ENTRYPOINT npm start 
