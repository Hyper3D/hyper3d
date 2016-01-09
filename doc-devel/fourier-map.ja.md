Fourier Opacity Mappingによる順不同透過の実装
=======================

FOMを利用した順不同透過の実装メモ。

Fourier Opacity Mapping
----

Fourier Opacity Mapping (以下 FOM) は、Jon Jansen 氏および Louis Bavoil 氏によって提案された、ボリューメトリックシャドウを特殊なエンコーディングのシャドウマップによって実現できる手法である。

FOM の論文の手法を単純に適用することで、透過オブジェクトからの半透明な影の実現ができる。すなわち、ボリューメトリックなオブジェクトから、不透明なオブジェクト、他のボリューメトリックなオブジェクト、またはそれ自身に影を投影することができる。
<!-- もっと一般化 -->

この手法は、シャドウマップの各画素 $(x, y)$ について、単一の深度値を格納する代わりに、濃度の分布を表す関数 $\sigma(x, y, z)$ を近似的(FOM では有限個フーリエ係数を用いた表現)に格納するものである。類似の手法として、Deep Shadow Maps (以下DSM) を用いた方法がある。<!-- TODO: DSM, Opacity Shadow Mappingとの比較 -->


順不同透過
----

リアルタイムCGでは透過オブジェクトの描画は簡単ではない。透過オブジェクトはブレンディングを用いてバッファに描画されるが、正しい結果を得るためには遠いものから近いものへ順に描画を行う必要がある。

単純な方法は描画の前にCPUでオブジェクトをあらかじめ深度値に関しソートしておくことである。しかしながらソートには長い時間が掛かってしまう。また、この手法は完全ではなく、[描画順を決定できないケース](https://www.opengl.org/wiki/File:Triple_overlap.png)も存在する。パーティクルの場合は全てのポリゴンが同一方向を向いているためこの問題は発生しないが、多数のパーティクルが存在する場合はソート時間だけではなく、ソート後の頂点データを毎フレームGPUに転送する時間も無視できなくなる。

以上の問題があるため、事前のソートが不要な透過オブジェクトの描画手法が近年よく研究されている。このような描画手法は順不同描画と呼ばれる。

順不同透過を実現する方法の一つとして、深度剥離 (Depth Peeling) がある。しかし、多数のオブジェクトが重なりあう場合は多数の描画パスが必要であり、また、ボリューメトリックなオブジェクトを扱うことはできない。このため、煙などのパーティクルオブジェクトに対して適用するのは実用的ではない。

別の手法として、Weight Blended Order-Independent Transparency (以下WBOIT) がある。 <!-- TODO: WBOITについて。(a) バッファの精度, (b) アーティファクト, (c) 加算ブレンディングの数値的安定性 -->

本ノートでは、FOM の手法を応用した、透過オブジェクトの順不同透過描画を実現手法を提案する。FOM はあるシャドウバッファ上の座標 $(x, y)$ について、深度値の範囲 $[0, z]$ を通過できる光の量を推定するものである。このため、FOMを各透過オブジェクトを描画する際の最終出力色への寄与の程度の推定に用いることができる。


手法
------

### 厚みのあるスプライトの密度分布

遮蔽物がある深度値 $d_i$ に存在し、そのアルファ値が $\alpha_i$ であるとき、 $s_i = \ln (1 - \alpha_i )$とするとその遮蔽物による FOM のフーリエ係数への寄与は次の式で表される。

$$\delta a'_{i,k} = 2 s_i \cos ( 2 \pi kd_i )  $$
$$\delta b'_{i,k} = 2 s_i \sin ( 2 \pi kd_i )  $$

この遮蔽物の深度値が広がりを持つ場合については、この式と密度分布関数 $s_i(d)$ を用いることで計算できる。

$$\delta a'_{i,k} = 2 \int_0^1 s_i(d) \cos ( 2 \pi kd ) \mathrm{d}d $$
$$\delta b'_{i,k} = 2 \int_0^1 s_i(d) \sin ( 2 \pi kd ) \mathrm{d}d $$

具体的な $s_i(d)$ を与えてみよう。例えば、$s_i(d) = S_i(H(d-d_{i,1}) - H(d-d_{i,2}))$ を仮定すると、

$$\delta a'_{i,k} = 2 S_i \left( \frac { \sin ( 2 \pi kd_{i,2} ) - \sin ( 2 \pi kd_{i,1} ) } { 2\pi k} \right)\ (k \neq 0)$$
$$\delta b'_{i,k} = -2 S_i \left( \frac { \cos ( 2 \pi kd_{i,2} ) - \cos ( 2 \pi kd_{i,1} ) } { 2\pi k} \right)\ (k \neq 0)$$
$$\delta a'_{i,0} = 2S_i(d_{i,2}-d_{i,1})$$

と求まる。また、例えば、$s_i(d) = S_i(d-d_{i,1})(H(d-d_{i,1}) - H(d-d_{i,2}))$ を仮定すると、

$$\delta a'_{i,k} = 2 \int_{d_{i,1}}^{d_{i,2}} S_i(d-d_{i,1}) \cos ( 2 \pi kd ) \mathrm{d}d $$
$$\delta a'_{i,k} = 2 S_i
\left[ (d-d_{i,1}) \cos ( 2 \pi kd ) \right]_{d_{i,1}}^{d_{i,2}} - \frac{2 S_i}{2\pi k}
\int_{d_{i,1}}^{d_{i,2}} \sin ( 2 \pi kd ) \mathrm{d}d  $$
$$\delta a'_{i,k} = 2 S_i
\left[ (d-d_{i,1}) \cos ( 2 \pi kd ) \right]_{d_{i,1}}^{d_{i,2}} + \frac{2 S_i}{4\pi^2 k^2}
\left[ \cos ( 2 \pi kd ) \right]_{d_{i,1}}^{d_{i,2}}  $$

TODO

### 最終描画

画面上のある点 $(x, y)$ における光の挙動について考える。ここでは透過オブジェクトを$n$個に分けて、$i$個目の密度関数を$\sigma_i(z)$、粒子の色を$c_i$とする。このとき、深度値 $[0, z]$ の範囲を通過できる光の割合を $T(z)$ すると、最終的な色は次の微分方程式により$C(1)$として求まる。

$$C(0) = 0, T(0) = 1$$
$$\frac{dT(z)}{dz} = -\sum_i \sigma_i(z) T(z),
 \frac{dC(z)}{dz} = \sum_i \sigma_i(z)c_i T(z)$$
 
これを解くと、

$$T(z) = \exp\left(-\int_0^z \sum_i \sigma_i(z) \mathrm{d}z \right)$$
$$\begin{align*}
C(z) &= \int_0^z \sum_i \sigma_i(z)c_i T(z) \mathrm{d}z  \\
     &= \sum_i c_i \int_0^z \sigma_i(z)T(z) \mathrm{d}z
\end{align*}$$

すなわち、最終的な色は、背景色を$C_0$とすると

$$C_f = T(1)C_0 + \sum_i c_i \int_0^1 \sigma_i(z)T(z) \mathrm{d}z $$

となる。

問題は、これをいかにして既存のレンダリングパイプラインに統合するかということである。アルファブレンディングを用いることができると、GPUで高速に処理を行うことができる。このための方法を次に示す。

まず、$T(z)$ を原論文の方法を用いて求める。この近似値は次のように表されるが、この係数 $a'_k, b'_k$ は透過オブジェクトごとに加算ブレンディングを行うことにより計算できる。

$$T(z) \approx \exp\left(
-\frac{a'_0}{2}z
 - \sum_{k=1}^n \frac{a'_k}{2 \pi k} \sin(2\pi kz)
 - \sum_{k=1}^n \frac{b'_k}{2 \pi k} (1 - \cos(2\pi kz))
\right) $$
$$a'_k = \sum_i a'_{i, k}, b'_k = \sum_i b'_{i, k}$$

続いて、この結果を用いて $C_f$ を求める。この式から、第二項は透過オブジェクトごとに加算ブレンディングを行うことで計算できることが分かる。問題は、この積分を計算する方法である。

$$\begin{align*}
C_i &= c_i \int_0^1 \sigma_i(z)T(z) \mathrm{d}z \\
&= c_i \int_0^1 \sigma_i(z) \exp\left(
-\frac{a'_0}{2}z
 - \sum_{k=1}^n \frac{a'_k}{2 \pi k} \sin(2\pi kz)
 - \sum_{k=1}^n \frac{b'_k}{2 \pi k} (1 - \cos(2\pi kz))
\right) \mathrm{d}z
\end{align*}$$

残念ながら、この積分は$\exp$の内側に$\sin, \cos$が含まれるため、$\sigma_i(z)$として単純な関数$\sigma_i(z) = S_i(H(z-z_{i,1}) - H(z-z_{i,2}))$を与えたとしても、解析的に解くのは難しい。次の一手は、(a)数値近似を行うか、(b)近似を行い、解析的に解くかのいずれかである。今回は(b)を用いる。積分を解析的に解けるよう、ここで使用する密度分布 $\sigma(z)$ を修正し、$z \in [z_{i,1}, z_{i,2}]$ の範囲内では一定の値 $\sigma_m$ をとるようにする。定数値は元の密度分布関数のその範囲の平均値とする。

$$\begin{align*}
\sigma_m &= \frac{1}{z_{i,2} - z_{i, 1}}
	\int_{z_{i,1}}^{z_{i,2}} \sigma(z) \mathrm{d}z \\
&= \frac{1}{z_{i,2} - z_{i, 1}} \left[
	\frac{a'_0}{2}z
	 + \sum_{k=1}^n \frac{a'_k}{2 \pi k} \sin(2\pi kz)
	 + \sum_{k=1}^n \frac{b'_k}{2 \pi k} (1 - \cos(2\pi kz))
\right]_{z_{i,1}}^{z_{i,2}}
\end{align*}$$

これを用いて、$\sigma(z)$の近似$\sigma'(z)$が得られる。

$$
\sigma'(z) = \begin{cases}
\sigma(z) & z < z_{i, 1} \\
\sigma_m & z_{i, 1} \leq z < z_{i,2}
\end{cases}
$$

これより、$T(z)$の近似$T'(z)$が求まる。

$$
T'(z) = \begin{cases}
T(z) & z < z_{i, 1} \\
T(z_{i, 1}) \exp(-\sigma_m(z-z_{i,1})) & z_{i, 1} \leq z < z_{i,2}
\end{cases}
$$

この結果と、このオブジェクトの密度分布関数 $\sigma_i(z) = S_i(H(z-z_{i,1}) - H(z-z_{i,2}))$ を先ほどの式に代入してみよう。

$$\begin{align*}
C_i &= c_i \int_0^1 \sigma_i(z)T'(z) \mathrm{d}z \\
	&= c_i S_i \int_{z_{i,1}}^{z_{i,2}} T'(z) \mathrm{d}z \\
	&= c_i S_i T(z_{i,1}) \int_{z_{i,1}}^{z_{i,2}} \exp(-\sigma_m(z-z_{i,1})) \mathrm{d}z \\
	&= c_i S_i T(z_{i,1}) \frac{1 - \exp(-\sigma_m(z_{i,2}-z_{i,1}))}{\sigma_m}  \\
\end{align*}$$

この結果を用い、高速に透過オブジェクトの順不同透過が実現できる。しかし、この近似はFOMを用いて生成した密度分布関数を修正したものを用いるため、誤差が生じる。特に、次の関係式が保たれなくなる可能性がある。

$$T(1) + \sum_i \int_0^1 \sigma_i(z)T(z) \mathrm{d}z = 1$$

この誤差を修正するためには、ブレンディングを行った最終結果をスケーリングし、上の関係式が保たれるようにすればよい。このためには、$c_i$を拡張色ベクトル$c'_i = (c_i\ 1)^T$に置き換え、ブレンディング後に最後の要素を$1 - T(1)$で除算する。拡張色ベクトルは4要素であるため、RGBAフレームバッファのピクセルに格納可能である。

実装
-----

* `VolumetricsFomVisibilityRenderer`: $T(z)$を計算し、フーリエ級数で近似する。
* `FomVolumetricRenderer`: 透過オブジェクトを最終的に描画する。
