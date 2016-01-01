HYPER3D WebGL Renderer
======================

[Examples](https://hyper3d.github.io/hyper3d-examples/) — Documentation — [Roadmap](https://trello.com/b/GN81FAP9/hyper3d-roadmap)

(put a very nice and catchy image here)

HYPER3D is a high-end (unofficial) renderer for [three.js](http://threejs.org/).

(TODO: more description here)

Building
--------

Before building Hyper3D, the following programs must be installed:

* The latest version of [Node.js](https://nodejs.org/)

### Prepare

```sh
# Clone the repository (you can just download ZIP instead)
git clone https://github.com/Hyper3D/hyper3d.git
cd hyper3d

# Install dependencies
npm install

# Download TypeScript definitions
npm run-script tsd-install
```

### Build as standalone JS library

```sh
npm run-script build
```

`hyper3d.js` and `hyper3d.min.js` are generated in the `build` directory. You can use them like this:

```html
<script type="application/javascript" src="three.min.js"></script>
<script type="application/javascript" src="hyper3d.min.js"></script>
```

### Build as npm package

If you intend to use Hyper3D on Browserify-based apps,
you might want a npm package instead of a simple JS file.
In this case, run the following command:

```sh
npm run-script lib

# ..or, rebuild automatically whenever a source file was modified
# npm run-script watch
```

After running these command this library can be used in your project
by using `npm link`.

License
-------

MIT.
