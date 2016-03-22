# Continua CLI

`continua` is a small command line interface for managing services that exist
on Continua service brokers.

## Current features

We currently support:

- [x] Using `continua init` to make a Continua project. This initilizes the
`.continua` folder and some metadata inside of it, very similar to how git
works.

- [x] Using `continua broker add [broker name] [broker url]` to add a track a
service broker. This works a lot like git remotes or the Docker deamon, but
instead of pushing code or Docker images, we are going to push _types_ to the
service boker.

- [x] Using `continua broker list` to get the current list of tracked service
brokers.

- [x] Using `continua broker rm [broker name]` to remove a broker, much like you
remove a git remote.

- [ ] Pushing a type to a broker using `continua push [broker name] [type]`.

- [ ] Pulling a type from a broker using `continua pull [broker name] [type]`.

- [ ] Listing types on a broker using `continua types [broker name]`.

## Bugs

Currently the system will silently ignore some nonsense arguments. For example,
`continua rm whatever` will currently do nothing.

I'm sure there are other bugs around, too. :)
