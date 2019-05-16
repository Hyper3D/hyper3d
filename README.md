HYPER3D WebGL Renderer
======================

[Examples](https://hyper3d.github.io/hyper3d-examples/) — Documentation — [Roadmap](https://trello.com/b/GN81FAP9/hyper3d-roadmap) —
[jsdo.itで試す](http://jsdo.it/yvt/hyper3d-simple2)

![](https://dl.dropboxusercontent.com/u/37804131/github/Screen%20Shot%202016-01-03%20at%202.16.45%20AM.jpg)

**This version of Hyper3D is no longer developed.** ~~Meanwhile, Hyper3D 3, the completely overhauled WebGL framework, is being developed [here](https://github.com/Hyper3D/hyper3d-3)!~~

HYPER3D is a high-end (unofficial) renderer for [three.js](http://threejs.org/).

<!-- Hyper3D is still at a very early stage of development. You might observe an unexpected behavior including distorted image,
browser crash, peformance breakdown, and shader compilation failure. APIs may change over time. -->

Features
--------

* Modern rendering engine
  * Physically based rendering
  * Roughness-metallic material workflow with support for custom shaders
  * High dynamic range rendering
  * High-quality post-effects
* Development support
  * Includes TypeScript definition
  * Integrated GPU Profiler

More features are coming! See [Roadmap](https://trello.com/b/GN81FAP9/hyper3d-roadmap).

Supported three.js Objects
---------------------------

Following three.js objects can safely be used with Hyper3D.

 * `Mesh`, `SkinnedMesh`
 * `Points`
 * `Geometry`, `BufferGeometry`
   * Current limitation: when using a `Geometry`, calling `dispose()` on it doesn't reclaim memory.
 * `PerspectiveCamera`
 * `AmbientLight`, `DirectionalLight`, `PointLight`
   * Current limitation: semantics of `PointLight`'s parameters differs significantly.
     Recommended to use `Hyper.PointLight` instead for future compatibility.
   * Current limitation: `shadowBias` and `shadowMapSize` is hardcoded.
   * Shadow can be rendered by setting `castShadow` to `true`. However, most parameters related to the shadow
     rendering are computed automatically and cannot be overrided.
   * `shadowDarkness` is not supported because it doesn't have a physical meaning.
 * `Texture`, `CubeTexture`
   * Current limitation 1: texture parameters are not respected
   * Current limitation 2: compressed textures are not supported
 * `MeshBasicMaterial`, `MeshPhongMaterial`
   * Current limitation: transparency is not supported at all. Vertex color is not supported.
   * Colored specular reflection, `wireframe`, `lightMap`, `aoMap` is not supported. Wireframe is not supported.
   * `specularMap` is treated as a roughness map.
   * Environment maps are not supported. Use `Hyper.ReflectionProbe` instead.
   * Most of the properties defined in the base class `Material` are not supported.
* `PointsMaterial`
   * Current limitation 1: transparency is not supported at all. Vertex color is not supported.
   * Current limitation 2: `sizeAttenuation` is ignored and the point size is always specified in the world-space coordinate system.

Hyper3D-specific Objects
------------------------

 * `Hyper.WebGLHyperRenderer`
 * `Hyper.ReflectionProbe` (inherits from `THREE.Object3D`)
   * Current limitation: positional probe is not supported.
 * `Hyper.Material`
   * Current limitation: transparency is not supported at all. `discard;` still works
   * This class allows you to write a custom shader that generates material parameters like `m_albedo` and `m_roughness`.
     This itself cannot be used as a material. It should be instantiated by creating `Hyper.MaterialInstance`.
 * `Hyper.MaterialInstance` (inherits from `THREE.Material`)
 * `Hyper.PointLight` (inherits from `THREE.PointLight`)
   * Current limitation: sized lights are not supported.

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

Contributing
------------

Contributions are always welcome. Feel free to talk to the developers.

License
-------

MIT.
