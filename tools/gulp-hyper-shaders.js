"use strict";

// partially based on glup-concat

// TODO: use glslmin

var through = require('through2'),
	fs = require('fs'),
	path = require('path'),
	gutil = require('gulp-util'),
    PluginError = gutil.PluginError,
	File = gutil.File;

module.exports = function (src) {
	
	var tmpl = fs.readFileSync(src, { encoding: 'utf8'});
	var shaders = {};
	var latestFile = null;
	var latestMod = null;
	
	function processShader(text, file) {
		text = text.replace('\r\n', '\n');
		text = text.replace('\r', '\n');
		var lines = text.split('\n');
		var outLines = [];
		var shader = {
			requires: [],
			parameters: [],
			attributes: [],
			source: null
		};
		
		for (var i = 0; i < lines.length; ++i) {
			var line = lines[i];
			var match = line.match(/^#pragma\s+([a-zA-Z0-9_]+)\s+(.*?)\s*$/);
			if (match) {
				switch (match[1]) {
					case 'parameter':
						shader.parameters.push(match[2]);
						break;
					case 'require':
						shader.requires.push(match[2]);
						break;
					case 'attribute':
						shader.attributes.push(match[2]);
						break;
					default:
						gutil.log(file, " has unknown pragma ", match[1]);
				}
			} else {
				outLines.push(line);
			}
		}
		
		shader.source = outLines.join('\n');
		
		shaders[path.basename(file.path, '.glsl')] = shader;
	}
	
	function processInput(file, enc, cb) {
		if (file.isNull()) {
			cb();
			return;
		}
		if (file.isStream()) {
			this.emit('error', new PluginError('gulp-hyper-shaders', 'Streaming file is not supported.'));
			cb();
			return;
		}
		
		var text = file.contents.toString('utf8');
		processShader(text, file);
		
		if (!latestMod || file.stat.mtime > latestMod) {
			latestMod = file.stat.mtime;
			latestFile = file;
		}
		
		cb();
	}
	
	function endStream (cb) {
		var shadersJson = JSON.stringify(shaders, null, 2);
		var text = tmpl.replace('/*--SHADERS--*/', shadersJson);
		
		var fl = latestFile.clone({ contents: false });
		fl.contents = new Buffer(text);
		fl.path = path.join(fl.base, 'ShaderChunks.ts');
		
		this.push(fl);
		cb();	
	}
	
	return through.obj(processInput, endStream);
};
