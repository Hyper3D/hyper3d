#pragma require FS_BaseGeometry
#pragma require Pack

varying highp vec3 v_viewPosition;

void main()
{
	evaluateMaterial(); // might discard the fragment

	highp float dist = min(length(v_viewPosition), 1.);
	gl_FragColor = vec4(pack24(dist), 1.);
}
