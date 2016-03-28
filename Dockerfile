FROM ubuntu
RUN apt-get update
RUN apt-get install -y ca-certificates
RUN apt-get install -y curl

# Ubuntu node version is a bit archaic, so we install a newer version with PPA.
# See: https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-an-ubuntu-14-04-server
RUN curl -sL https://deb.nodesource.com/setup | sudo bash -
RUN sudo apt-get install -y nodejs

# Add the current repository into the container root. This will allow us to
# run something like `docker run hausdorff/ctest node ./dist/src/ServiceBroker/main.js`
ADD . /
