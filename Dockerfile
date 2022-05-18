FROM node:alpine

RUN apk update && apk add --no-cache mono --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing && \
    apk add --no-cache --virtual=.build-dependencies ca-certificates && \
    cert-sync /etc/ssl/certs/ca-certificates.crt && \
    apk del .build-dependencies &&\
    apk add --update --no-cache wget unzip openssh bash &&\
    wget http://pascalabc.net/downloads/PABCNETC.zip -O /tmp/PABCNETC.zip &&\
    mkdir -p /opt/pabcnetc &&\
    mkdir -p /opt/server &&\
    mkdir -p /opt/server/user_data &&\
    unzip /tmp/PABCNETC.zip -d /opt/pabcnetc

RUN echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
RUN adduser -h /home/qwerty -s /bin/sh -D qwerty
RUN echo -n 'qwerty:qwerty12345' | chpasswd
RUN touch /opt/server/log.txt
EXPOSE 22
    
COPY app2.js /opt/server
COPY database.js /opt/server
COPY test.js /opt/server
COPY package.json /opt/server
COPY package-lock.json /opt/server
WORKDIR /opt/server
COPY start_server.sh /opt/server
RUN chmod 0755 /opt/server/start_server.sh
RUN chmod 0755 /opt/server/log.txt

CMD npm install pg ws sha3 && node app2.js
