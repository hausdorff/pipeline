# Installation notes for different platforms.
Brief notes about platforms we have had trouble building on, and what it took to get things to build.


## Ubuntu 15.04
_March 27, 2016_ -- Head is at hash `aaf53f761f6676026e4f75f93c103d3f8bca2876` (commit message: `Remove unnecessary test files`).

**Problem:** Ran `npm install && npm typings && npm run build` as normal, but `npm typings` failed. `npm` error output follows, note the versions of `npm` and `node`, and the error message that suggests `This failure might be due to the use of legacy binary "node"`.

```
> Forward@0.1.0 build /root/src/pipeline
> tsc -p .


npm ERR! Forward@0.1.0 build: `tsc -p .`
npm ERR! Exit status 1
npm ERR!
npm ERR! Failed at the Forward@0.1.0 build script.
npm ERR! This is most likely a problem with the Forward package,
npm ERR! not with npm itself.
npm ERR! Tell the author that this fails on your system:
npm ERR!     tsc -p .
npm ERR! You can get their info via:
npm ERR!     npm owner ls Forward
npm ERR! There is likely additional logging output above.
npm ERR! System Linux 3.19.0-22-generic
npm ERR! command "/usr/bin/nodejs" "/usr/bin/npm" "run" "build"
npm ERR! cwd /root/src/pipeline
npm ERR! node -v v0.10.25


npm ERR! npm -v 1.4.21
npm ERR! code ELIFECYCLE
npm WARN This failure might be due to the use of legacy binary "node"
npm WARN For further explanations, please read
/usr/share/doc/nodejs/README.Debian

npm ERR!
npm ERR! Additional logging details can be found in:
npm ERR!     /root/src/pipeline/npm-debug.log
npm ERR! not ok code 0
```

**Mitigation:** As the error message suggests, the problem was mitigated when we:

1. Upgraded the `nodejs` binary using the NodeSource PPA (see DigitalOcean guide [here](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-an-ubuntu-14-04-server)).
2. Ran `rm -rf dist && rm -rf node_modules`.
3. Re-ran `npm install && npm typings && npm run build`.
