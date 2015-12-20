HYPER3D WebGL Renderer
======================

(put a very nice and catchy image here)

HYPER3D is a high-end (unofficial) renderer for [three.js](http://threejs.org/).

(TODO: more text here)

Building
--------

### Prepare

```sh
npm Install
npm run-script tsd-install
```

### Build as npm package

```sh
npm run-script lib

# ..or, automatically rebuild whenever a source file was modified
# npm run-script watch
```

Compiled code is stored in the `dist` directory.

Now the library is compiled to JavaScript and can be used as a npm package. 
For example, you can make this library available in other projects on your computer
by running `sudo npm link` in this directory and then running `npm link hyper3d` in
your project.

### Build as standalone JS library

If you are intend to use this library for a standard website, and you aren't using
a package system like Browserify or WebPack, then you might want a single JS file 
containing everything. In this case, use the following command to bundle up all
required modules into a single file.

```sh
npm run-script build
```

Generated files can be found at the `build` directory. You can use it like this:

```html
<script type="application/javascript" src="three.min.js"></script>
<script type="application/javascript" src="hyper3d.min.js"></script>
```

License
-------


