FROM node:alpine

RUN apk update && apk add --no-cache mono --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing && \
    apk add --no-cache --virtual=.build-dependencies ca-certificates && \
    cert-sync /etc/ssl/certs/ca-certificates.crt && \
    apk del .build-dependencies &&\
    apk add --no-cache wget unzip &&\
    wget http://pascalabc.net/downloads/PABCNETC.zip -O /tmp/PABCNETC.zip &&\
    mkdir -p /opt/pabcnetc &&\
    mkdir -p /opt/compiler &&\
    unzip /tmp/PABCNETC.zip -d /opt/pabcnetc
    
COPY app2.js /opt/compiler
COPY database.js /opt/compiler
COPY test.js /opt/compiler
COPY package.json /opt/compiler
COPY package-lock.json /opt/compiler
WORKDIR /opt/compiler
CMD npm -i && node app2.js
