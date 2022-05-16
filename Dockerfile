FROM node:alpine

RUN apk -i update && apk -i add --no-cache mono --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing && \
    apk -i add --no-cache --virtual=.build-dependencies ca-certificates && \
    cert-sync /etc/ssl/certs/ca-certificates.crt && \
    apk -i del .build-dependencies &&\
    apk -i add --no-cache wget unzip &&\
    wget http://pascalabc.net/downloads/PABCNETC.zip -O /tmp/PABCNETC.zip &&\
    mkdir /opt/pabcnetc &&\
    unzip /tmp/PABCNETC.zip -d /opt/pabcnetc
    
COPY app2.js
COPY database.js
COPY test.js
COPY package.json
COPY package-lock.json
CMD npm -i && node app2.js
