#pragma parameter isFullScreen
#pragma require FS_BaseLight

#if !c_isFullScreen
varying float v_w;
#endif


void setupPositionalLight()
{
#if !c_isFullScreen
	perspectiveScaling = 1. / v_w;
#endif
}
