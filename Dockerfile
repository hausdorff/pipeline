# Maintainer's notes: This `Dockerfile` will create a whole-repository docker
# image, which is crude, but we can use this to deploy our simple applications
# on top of it. Typically it this looks something like:
#   1. `docker build -t hausdorff/ctest .`
#   2. `docker push hausdorff/ctest`
#
# And then:
#   3 `docker run hausdorff/ctest node ./dist/Examples/SimpleDatabaseAndCachingApp/application.js`

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
